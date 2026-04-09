// app/api/contact/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";
import type { NextRequest } from "next/server";
import nodemailer from "nodemailer";

import { auditWriteMust } from "@/lib/audit/auditWrite";
import { parseGrowthAbFromCookieHeader } from "@/lib/growth/growthAbCookie";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { runInstrumentedApi } from "@/lib/http/withObservability";
import { upsertLeadFromContactForm } from "@/lib/pipeline/upsertLead";
import {
  AI_RATE_LIMIT_SCOPE,
  CONTACT_FORM_RL,
  checkAiRateLimit,
  rateLimitOverload,
} from "@/lib/security/rateLimit";
import { maskEmail } from "@/lib/security/pii";
import { SUPPORT_EMAIL, SYSTEM_EMAIL_ALLOWLIST, normEmail } from "@/lib/system/emails";
import { contactFormSchema } from "@/lib/validation/schemas";

/* =========================================================
   Types
========================================================= */

type Body = {
  name?: string;
  email?: string;
  company?: string | null;
  phone?: string | null;
  subject?: string;
  message?: string;
  rid?: string;
  /** Valgfri SoMe-attributjon (samme som query postId). */
  postId?: string;
  post_id?: string;

  // Honeypot (valgfritt). Hvis bots fyller dette, svarer vi ok stille.
  website?: string;
};

/* =========================================================
   Helpers
========================================================= */

function safeStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function getClientIp(req: NextRequest) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Leser JSON-body. Tidligere krevde vi `Content-Type: application/json` — manglende header
 * (noen klienter/proxyer) ga `null` og 400 «Ugyldig forespørsel» uten spor i logg.
 */
async function readJson(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch (parseErr) {
    console.error("[CONTACT_JSON_PARSE]", parseErr);
    return null;
  }
}

/* =========================================================
   SMTP
========================================================= */

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function smtpTransport() {
  const host = process.env.SMTP_HOST || "mail.lunchportalen.no";
  const port = Number(process.env.SMTP_PORT || "465");
  const secure = String(process.env.SMTP_SECURE || "true") === "true";

  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
   System email selection (audit:repo)
========================================================= */

function pickSystemEmail(envValue: string | undefined, fallback: string) {
  const candidate = normEmail(envValue || fallback);
  // allow only known system addresses (env can override, but must be allowlisted)
  if (SYSTEM_EMAIL_ALLOWLIST.includes(candidate)) return candidate;
  return normEmail(fallback);
}

/* =========================================================
   Audit (type-safe vs AuditInput: requires entity_type/entity_id)
========================================================= */

async function auditSafe(action: string, rid: string) {
  try {
    await auditWriteMust({
      action,
      rid,
      entity_type: "contact",
      entity_id: rid,
    });
  } catch (auditErr) {
    console.error("[CONTACT_AUDIT_FAIL]", action, auditErr);
  }
}

/* =========================================================
   Route — flow: parse → validate → lead → email (optional) → success
   (ingen global try/catch rundt hele handleren)
========================================================= */

export async function POST(req: NextRequest) {
  const rid = req.headers.get("x-rid") || makeRid("contact");
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent") || "";

  const rlRes = checkAiRateLimit(ip, `${AI_RATE_LIMIT_SCOPE}:contact_public`, CONTACT_FORM_RL);
  if (!rlRes.allowed) {
    return jsonErr(rid, "For mange forsøk. Prøv igjen om litt.", 429, "RATE_LIMIT");
  }
  if (!rateLimitOverload(ip, 50)) {
    return jsonErr(rid, "Tjenesten er midlertidig overbelastet. Prøv igjen senere.", 503, "OVERLOAD");
  }

  return runInstrumentedApi(req, { rid, route: "/api/contact" }, async () => {
    const body = (await readJson(req)) as Body | null;
    if (!body) {
      console.error("[CONTACT_BODY_NULL]", "invalid or empty json body");
      return jsonErr(rid, "Ugyldig forespørsel.", 400, "INVALID_JSON");
    }

    if (safeStr(body.website).trim()) return jsonOk(rid, null, 200);

    const merged = {
      name: body.name,
      email: body.email,
      company: body.company ?? null,
      phone: body.phone ?? null,
      subject: body.subject,
      message: body.message,
      postId: safeStr(body.postId).trim() || safeStr(body.post_id).trim() || undefined,
      post_id: body.post_id,
      rid: body.rid,
      website: body.website,
    };

    const parsed = contactFormSchema.safeParse(merged);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Ugyldig forespørsel.";
      return jsonErr(rid, first, 422, "VALIDATION_FAILED", parsed.error.flatten());
    }

    const { name, email, company, phone, subject, message } = parsed.data;
    const postRaw = safeStr(parsed.data.postId).trim() || safeStr(parsed.data.post_id).trim();

    // eslint-disable-next-line no-console
    console.log("[CONTACT_BEFORE_LEAD]", {
      email: maskEmail(email),
      company: company || null,
      postId: postRaw || null,
    });

    const ab = parseGrowthAbFromCookieHeader(req.headers.get("cookie"));

    let lead: { id: string } | null = null;
    try {
      lead = await upsertLeadFromContactForm({
        email,
        company: typeof company === "string" && company.trim() ? company.trim() : null,
        postId: postRaw || undefined,
        rid,
        abVariantId: ab?.variantId ?? null,
      });
    } catch (leadErr: unknown) {
      const detail = leadErr instanceof Error ? leadErr.message : String(leadErr);
      const stack = leadErr instanceof Error ? leadErr.stack : undefined;
      console.error("[LEAD_INSERT_ERROR]", { rid, detail, stack });
      return jsonErr(rid, "Kunne ikke lagre kontakt. Prøv igjen om litt.", 500, "LEAD_INSERT_FAILED", detail);
    }

    if (!lead || typeof lead.id !== "string" || !lead.id) {
      console.error("[LEAD_INSERT_EMPTY]", { rid, lead });
      return jsonErr(rid, "Kunne ikke lagre kontakt. Prøv igjen om litt.", 500, "LEAD_EMPTY");
    }

    // eslint-disable-next-line no-console
    console.log("[LEAD_CREATED]", lead);

    if (postRaw) {
      // eslint-disable-next-line no-console
      console.log("[POST_LINKED]", { postId: postRaw, leadId: lead.id });
    }

    const to = pickSystemEmail(process.env.CONTACT_TO, SUPPORT_EMAIL);
    const from = pickSystemEmail(process.env.CONTACT_FROM, SUPPORT_EMAIL);

    const mailSubject = `Kontakt: ${subject} (RID: ${rid})`;

    const text =
      `Ny henvendelse fra kontakt-skjema\n\n` +
      `RID: ${rid}\n` +
      `Navn: ${name}\n` +
      `E-post: ${email}\n` +
      (company ? `Bedrift: ${company}\n` : "") +
      (phone ? `Telefon: ${phone}\n` : "") +
      `IP: ${ip}\n` +
      `UA: ${ua}\n\n` +
      `Melding:\n${message}\n`;

    const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
      <h2 style="margin:0 0 12px 0">Ny henvendelse</h2>
      <div style="padding:12px 14px;border:1px solid #eee;border-radius:12px;background:#fafafa">
        <div><strong>RID:</strong> ${escapeHtml(rid)}</div>
        <div><strong>Navn:</strong> ${escapeHtml(name)}</div>
        <div><strong>E-post:</strong> ${escapeHtml(email)}</div>
        ${company ? `<div><strong>Bedrift:</strong> ${escapeHtml(company)}</div>` : ""}
        ${phone ? `<div><strong>Telefon:</strong> ${escapeHtml(phone)}</div>` : ""}
        <div style="margin-top:10px;color:#666;font-size:12px">
          IP: ${escapeHtml(ip)} · UA: ${escapeHtml(ua)}
        </div>
      </div>
      <h3 style="margin:18px 0 8px 0">Melding</h3>
      <div style="white-space:pre-wrap;padding:12px 14px;border:1px solid #eee;border-radius:12px">
        ${escapeHtml(message)}
      </div>
    </div>
  `;

    let emailSent = false;
    try {
      const transporter = smtpTransport();

      await transporter.sendMail({
        from,
        to,
        replyTo: email,
        subject: mailSubject,
        text,
        html,
      });

      emailSent = true;
      // eslint-disable-next-line no-console
      console.log("[EMAIL_SENT]", { rid });
      await auditSafe("contact.submit", rid);
    } catch (emailErr: unknown) {
      console.error("[EMAIL_FAIL]", emailErr);
      await auditSafe("contact.submit_email_failed", rid);
    }

    /** Additiv: audit — lead kan være lagret selv om SMTP feiler; klient/ops kan lese `emailSent`. */
    return jsonOk(rid, { leadId: lead.id, emailSent }, 200);
  });
}

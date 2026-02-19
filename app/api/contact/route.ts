// app/api/contact/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import nodemailer from "nodemailer";

import { auditWriteMust } from "@/lib/audit/auditWrite";
import { SUPPORT_EMAIL, SYSTEM_EMAIL_ALLOWLIST, normEmail } from "@/lib/system/emails";

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

  // Honeypot (valgfritt). Hvis bots fyller dette, svarer vi ok stille.
  website?: string;
};

/* =========================================================
   Helpers
========================================================= */

function makeRid() {
  const a = Math.random().toString(16).slice(2, 8);
  const b = Date.now().toString(16).slice(-6);
  return `rid_${b}${a}`;
}

function safeStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function getClientIp(req: NextRequest) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

async function readJson(req: NextRequest): Promise<any> {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function jsonOk(req: NextRequest, payload: any, status = 200) {
  const rid = payload?.rid || req.headers.get("x-rid") || "";
  return NextResponse.json(payload, {
    status,
    headers: {
      "cache-control": "no-store, max-age=0",
      "x-rid": rid,
    },
  });
}

function jsonErr(req: NextRequest, message: string, status = 400, rid?: string) {
  const r = rid || req.headers.get("x-rid") || "";
  return NextResponse.json(
    { ok: false, message, rid: r || null },
    {
      status,
      headers: {
        "cache-control": "no-store, max-age=0",
        "x-rid": r,
      },
    }
  );
}

/* =========================================================
   Simple in-memory rate limit (per instance)
========================================================= */

const RL_WINDOW_MS = 60_000; // 1 min
const RL_MAX = 8; // 8 req/min per IP
const rl = new Map<string, { ts: number; count: number }>();

function rateLimit(ip: string) {
  const now = Date.now();
  const cur = rl.get(ip);
  if (!cur) {
    rl.set(ip, { ts: now, count: 1 });
    return { ok: true };
  }
  if (now - cur.ts > RL_WINDOW_MS) {
    rl.set(ip, { ts: now, count: 1 });
    return { ok: true };
  }
  if (cur.count >= RL_MAX) return { ok: false };
  cur.count += 1;
  rl.set(ip, cur);
  return { ok: true };
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
  } catch {
    // aldri blokker kontaktflyt på audit
  }
}

/* =========================================================
   Route
========================================================= */

export async function POST(req: NextRequest) {
  const rid = req.headers.get("x-rid") || makeRid();
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent") || "";

  // RL
  const rlRes = rateLimit(ip);
  if (!rlRes.ok) return jsonErr(req, "For mange forsøk. Prøv igjen om litt.", 429, rid);

  const body = (await readJson(req)) as Body | null;
  if (!body) return jsonErr(req, "Ugyldig forespørsel.", 400, rid);

  // Honeypot (bots)
  if (safeStr(body.website).trim()) return jsonOk(req, { ok: true, rid }, 200);

  const name = safeStr(body.name).trim();
  const email = safeStr(body.email).trim();
  const company = safeStr(body.company).trim();
  const phone = safeStr(body.phone).trim();
  const subject = safeStr(body.subject).trim();
  const message = safeStr(body.message).trim();

  // Validation
  if (!name) return jsonErr(req, "Navn mangler.", 400, rid);
  if (!email) return jsonErr(req, "E-post mangler.", 400, rid);
  if (!isEmail(email)) return jsonErr(req, "Ugyldig e-postadresse.", 400, rid);
  if (!subject) return jsonErr(req, "Emne mangler.", 400, rid);
  if (!message) return jsonErr(req, "Melding mangler.", 400, rid);

  if (name.length > 140) return jsonErr(req, "Navn er for langt.", 400, rid);
  if (email.length > 200) return jsonErr(req, "E-post er for lang.", 400, rid);
  if (company.length > 200) return jsonErr(req, "Bedrift er for lang.", 400, rid);
  if (phone.length > 40) return jsonErr(req, "Telefon er for langt.", 400, rid);
  if (subject.length > 180) return jsonErr(req, "Emne er for langt.", 400, rid);
  if (message.length > 5000) return jsonErr(req, "Meldingen er for lang.", 400, rid);

  // ✅ Must not hardcode system email: use lib/system/emails.ts
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

    await auditSafe("contact.submit", rid);

    return jsonOk(req, { ok: true, rid }, 200);
  } catch {
    await auditSafe("contact.submit_failed", rid);
    return jsonErr(req, "Kunne ikke sende meldingen. Prøv igjen om litt.", 500, rid);
  }
}

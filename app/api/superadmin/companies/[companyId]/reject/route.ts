// app/api/superadmin/companies/[companyId]/reject/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(401, { rid }, "UNAUTHENTICATED", "Du må være innlogget.");
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function cleanEmail(v: any) {
  return safeStr(v).toLowerCase();
}
function safeName(v: any) {
  const s = safeStr(v);
  return s.length ? s : "der";
}
function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function env(name: string): string | null {
  const v = process.env[name];
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

type MailResult = { sent: boolean; error: string | null };

async function trySendMail(params: { to: string; subject: string; text: string; replyTo?: string }): Promise<MailResult> {
  const host = env("SMTP_HOST");
  const portRaw = env("SMTP_PORT");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  const from = env("SMTP_FROM");

  if (!host || !portRaw || !user || !pass || !from) return { sent: false, error: "smtp_env_missing" };

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) return { sent: false, error: "smtp_port_invalid" };

  let nodemailer: any;
  try {
    nodemailer = await import("nodemailer");
  } catch {
    return { sent: false, error: "nodemailer_not_installed" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      replyTo: params.replyTo,
    });

    return { sent: true, error: null };
  } catch (e: any) {
    return { sent: false, error: String(e?.message ?? e) };
  }
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.reject.POST", ["superadmin"]);
  if (deny) return deny;

  const params = await ctx.params;
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(400, a, "BAD_REQUEST", "Ugyldig companyId.");

  const admin = supabaseAdmin();

  try {
    // 1) Les firma (trygge kolonner)
    const { data: existing, error: exErr } = await admin
      .from("companies")
      .select("id,name,status,updated_at")
      .eq("id", companyId)
      .maybeSingle();

    if (exErr) return jsonErr(500, a, "DB_ERROR", "Kunne ikke lese firma.", exErr);
    if (!existing) return jsonErr(404, a, "NOT_FOUND", "Firma finnes ikke.");

    const currentStatus = String((existing as any).status ?? "").toLowerCase();

    // Idempotent: already closed
    if (currentStatus === "closed") {
      return jsonOk(a, { ok: true, rid: a.rid, company: existing, meta: { alreadyClosed: true } }, 200);
    }

    // Kun pending -> closed
    if (currentStatus !== "pending") {
      return jsonErr(409, a, "INVALID_STATE", `Kan ikke avslå firma fra status '${(existing as any).status}'.`, {
        status: (existing as any).status,
      });
    }

    // 2) Update -> closed
    const now = new Date().toISOString();

    const { data: updated, error: upErr } = await admin
      .from("companies")
      .update({ status: "closed", updated_at: now } as any)
      .eq("id", companyId)
      .select("id,name,status,updated_at")
      .single();

    if (upErr) return jsonErr(500, a, "DB_ERROR", "Kunne ikke avslå firma.", upErr);

    // 3) agreement_json best effort (service role, så dette bør gå)
    let agreement: any = null;
    try {
      const { data: agr } = await admin.from("companies").select("agreement_json").eq("id", companyId).maybeSingle();
      agreement = (agr as any)?.agreement_json ?? null;
    } catch {
      agreement = null;
    }

    // 4) Send mail best effort
    const supportEmail = "post@lunchportalen.no";

    const to = cleanEmail(agreement?.admin?.email);
    const contactName = safeName(agreement?.admin?.full_name);
    const companyName = safeStr((updated as any)?.name) || "firmaet deres";

    let emailSent = false;
    let emailError: string | null = null;

    if (!to) {
      emailError = "missing_recipient_email";
    } else {
      const subject = "Lunchportalen – svar på registrering";
      const text =
        `Hei ${contactName},\n\n` +
        `Takk for forespørselen. Vi har dessverre ikke kapasitet til å ta inn ${companyName} på nåværende tidspunkt.\n\n` +
        `Dersom dere ønsker, kan dere svare på denne e-posten eller ta kontakt på ${supportEmail}, så kan vi se på muligheter fremover.\n\n` +
        `Vennlig hilsen\n` +
        `Lunchportalen`;

      const mail = await trySendMail({ to, subject, text, replyTo: supportEmail });
      emailSent = mail.sent;
      emailError = mail.sent ? null : mail.error;
    }

    return jsonOk(
      a,
      {
        ok: true,
        rid: a.rid,
        company: updated,
        meta: {
          transitionedFrom: "pending",
          transitionedTo: "closed",
          emailSent,
          emailError,
        },
      },
      200
    );
  } catch (e: any) {
    return jsonErr(500, a, "SERVER_ERROR", "Uventet feil i reject.", { message: String(e?.message ?? e) });
  }
}

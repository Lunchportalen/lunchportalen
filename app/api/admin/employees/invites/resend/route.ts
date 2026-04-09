// app/api/admin/employees/invites/resend/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import nodemailer from "nodemailer";


// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";
import { buildEmployeeInviteUrl } from "@/lib/invites/employeeInviteUrl";

/* =========================================================
   Helpers
========================================================= */

function safeUUID(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const ok =
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(s);
  return ok ? s : null;
}

function mustEnvStr(name: string): string | null {
  const v = process.env[name];
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function getPublicAppUrl(): string | null {
  const env =
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  const s = String(env ?? "").trim();
  if (!s) return null;

  const u = s.startsWith("http") ? s : `https://${s}`;
  return u.replace(/\/+$/, "");
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function sendInviteEmail(to: string, link: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const host = mustEnvStr("SMTP_HOST");
  const portRaw = mustEnvStr("SMTP_PORT");
  const user = mustEnvStr("SMTP_USER");
  const pass = mustEnvStr("SMTP_PASS");
  const from = String(process.env.SMTP_FROM ?? user ?? "").trim();

  if (!host) return { ok: false, error: "Missing env SMTP_HOST" };
  if (!portRaw) return { ok: false, error: "Missing env SMTP_PORT" };
  if (!user) return { ok: false, error: "Missing env SMTP_USER" };
  if (!pass) return { ok: false, error: "Missing env SMTP_PASS" };
  if (!from) return { ok: false, error: "Missing env SMTP_FROM" };

  const port = Number(portRaw);
  if (!Number.isFinite(port)) return { ok: false, error: "Invalid SMTP_PORT" };

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const subject = "Invitasjon til Lunchportalen";
  const text =
    `Du er invitert til Lunchportalen.\n\n` +
    `Åpne denne lenken for å akseptere invitasjonen og sette passord:\n${link}\n\n` +
    `Hvis du ikke forventet denne e-posten, kan du ignorere den.`;

  try {
    await transport.sendMail({ from, to, subject, text });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e ?? "Email send failed") };
  }
}

/* =========================================================
   Route
========================================================= */
export async function POST(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.employees.invites.resend", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const body = await readJson(req);
  const inviteId = safeUUID((body as any)?.inviteId ?? (body as any)?.id);
  if (!inviteId) return jsonErr(rid, "Ugyldig inviteId.", 400, "INVALID_INVITE_ID");

  const appUrl = getPublicAppUrl();
  if (!appUrl) {
    return jsonErr(rid, "Mangler app-url konfigurasjon.", 500, { code: "CONFIG_ERROR", detail: {
      missing: ["PUBLIC_APP_URL (eller NEXT_PUBLIC_APP_URL/NEXT_PUBLIC_SITE_URL/NEXT_PUBLIC_VERCEL_URL)"],
    } });
  }

  const admin = supabaseAdmin();

  try {
    // must belong to company, not used
    const cur = await admin
      .from("employee_invites")
      .select("id, email, token_hash, expires_at, used_at")
      .eq("id", inviteId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (cur.error) return jsonErr(rid, "Kunne ikke hente invitasjon.", 500, { code: "INVITE_READ_FAILED", detail: cur.error });
    if (!cur.data) return jsonErr(rid, "Invitasjon ikke funnet.", 404, "INVITE_NOT_FOUND");
    if ((cur.data as any).used_at) return jsonErr(rid, "Invitasjonen er allerede brukt.", 400, "ALREADY_USED");

    const email = String((cur.data as any).email ?? "").trim();
    if (!email) return jsonErr(rid, "Invitasjonen mangler e-post.", 500, "INVITE_INVALID");

    const oldHash = String((cur.data as any).token_hash ?? "");

    // rotate token
    const token = crypto.randomBytes(32).toString("hex");
    const newHash = sha256Hex(token);
    const link = buildEmployeeInviteUrl(appUrl, token);
    const newExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(); // 7 days

    // update first; rollback on mail failure
    const upd1 = await admin
      .from("employee_invites")
      .update({ token_hash: newHash, expires_at: newExpiry })
      .eq("id", inviteId)
      .eq("company_id", companyId)
      .is("used_at", null);

    if (upd1.error) return jsonErr(rid, "Kunne ikke oppdatere invitasjon.", 500, { code: "INVITE_UPDATE_FAILED", detail: upd1.error });

    const sent = await sendInviteEmail(email, link);
    if (sent.ok === false) {
      // rollback to old hash (best effort)
      await admin.from("employee_invites").update({ token_hash: oldHash }).eq("id", inviteId).eq("company_id", companyId);
      return jsonErr(rid, "Kunne ikke sende e-post. Ingenting ble lagret.", 500, { code: "EMAIL_SEND_FAILED", detail: { message: sent.error } });
    }

    const upd2 = await admin
      .from("employee_invites")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", inviteId)
      .eq("company_id", companyId);

    if (upd2.error) {
      return jsonOk(rid, {
        message: "Invitasjon sendt (men last_sent_at kunne ikke oppdateres).",
        warning: upd2.error,
      });
    }

    return jsonOk(rid, { message: "Invitasjon sendt på nytt." });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}

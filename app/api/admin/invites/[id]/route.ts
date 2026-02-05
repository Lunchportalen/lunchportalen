// app/api/admin/invites/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import nodemailer from "nodemailer";

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeUUID(v: unknown) {
  const s = safeStr(v);
  if (!s) return null;
  const ok =
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(s);
  return ok ? s : null;
}

function getPublicAppUrl(): string | null {
  const env =
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  const s = safeStr(env);
  if (!s) return null;

  const u = s.startsWith("http") ? s : `https://${s}`;
  return u.replace(/\/+$/, "");
}

type SmtpCfgOk = { ok: true; host: string; port: number; user: string; pass: string; from: string; secure: boolean };

type SmtpCfgErr = { ok: false; error: string };

type SmtpCfg = SmtpCfgOk | SmtpCfgErr;

function smtpConfig(): SmtpCfg {
  const host = process.env.SMTP_HOST || process.env.LP_SMTP_HOST;
  const portRaw = process.env.SMTP_PORT || process.env.LP_SMTP_PORT;
  const user = process.env.SMTP_USER || process.env.LP_SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.LP_SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.LP_SMTP_FROM || user;

  if (!host) return { ok: false, error: "Missing env SMTP_HOST" };
  if (!portRaw) return { ok: false, error: "Missing env SMTP_PORT" };
  if (!user) return { ok: false, error: "Missing env SMTP_USER" };
  if (!pass) return { ok: false, error: "Missing env SMTP_PASS" };
  if (!from) return { ok: false, error: "Missing env SMTP_FROM" };

  const port = Number(portRaw);
  if (!Number.isFinite(port)) return { ok: false, error: "Invalid SMTP_PORT" };

  const secure = port === 465;
  return { ok: true, host: String(host), port, user: String(user), pass: String(pass), from: String(from), secure };
}

async function sendInviteEmail(to: string, link: string) {
  const cfg = smtpConfig();
  if (cfg.ok === false) return { ok: false as const, error: cfg.error };

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const subject = "Invitasjon til Lunchportalen";
  const text =
    `Du er invitert til Lunchportalen.\n\n` +
    `Åpne denne lenken for å akseptere invitasjonen og sette passord:\n${link}\n\n` +
    `Hvis du ikke forventet denne e-posten, kan du ignorere den.`;

  try {
    await transport.sendMail({ from: cfg.from, to, subject, text });
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message ?? e ?? "Email send failed") };
  }
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function revokeInvite(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, companyId: string, inviteId: string) {
  const del = await admin
    .from("employee_invites")
    .delete()
    .eq("id", inviteId)
    .eq("company_id", companyId)
    .is("used_at", null);

  if (del.error) return { ok: false as const, error: del.error };
  return { ok: true as const };
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.invites.patch", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(scope.companyId);
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const inviteId = safeUUID(ctx?.params?.id);
  if (!inviteId) return jsonErr(rid, "Ugyldig inviteId.", 400, "INVALID_INVITE_ID");

  const body = await readJson(req);
  const action = safeStr(body?.action || body?.op || "").toLowerCase();
  if (!action) return jsonErr(rid, "Mangler action.", 400, "BAD_REQUEST");

  const admin = supabaseAdmin();

  try {
    if (action === "revoke" || action === "cancel") {
      const revoked = await revokeInvite(admin, companyId, inviteId);
      if (!revoked.ok) return jsonErr(rid, "Kunne ikke trekke tilbake invitasjonen.", 500, { code: "REVOKE_FAILED", detail: revoked.error });
      return jsonOk(a.ctx.rid, { status: "revoked" });
    }

    if (action === "resend" || action === "link") {
      const appUrl = getPublicAppUrl();
      if (!appUrl) {
        return jsonErr(rid, "Mangler app-url konfigurasjon.", 500, { code: "CONFIG_ERROR", detail: {
          missing: ["PUBLIC_APP_URL (eller NEXT_PUBLIC_APP_URL/NEXT_PUBLIC_SITE_URL/NEXT_PUBLIC_VERCEL_URL)"],
        } });
      }

      const cur = await admin
        .from("employee_invites")
        .select("id,email,token_hash,expires_at,used_at")
        .eq("id", inviteId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (cur.error) return jsonErr(rid, "Kunne ikke hente invitasjon.", 500, { code: "INVITE_READ_FAILED", detail: cur.error });
      if (!cur.data) return jsonErr(rid, "Invitasjon ikke funnet.", 404, "INVITE_NOT_FOUND");
      if ((cur.data as any).used_at) return jsonErr(rid, "Invitasjonen er allerede brukt.", 400, "ALREADY_USED");

      const email = safeStr((cur.data as any).email);
      if (!email) return jsonErr(rid, "Invitasjonen mangler e-post.", 500, "INVITE_INVALID");

      const oldHash = safeStr((cur.data as any).token_hash);
      const token = crypto.randomBytes(32).toString("hex");
      const newHash = sha256Hex(token);
      const link = `${appUrl}/accept-invite?token=${encodeURIComponent(token)}`;
      const newExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

      const upd1 = await admin
        .from("employee_invites")
        .update({ token_hash: newHash, expires_at: newExpiry })
        .eq("id", inviteId)
        .eq("company_id", companyId)
        .is("used_at", null);

      if (upd1.error) return jsonErr(rid, "Kunne ikke oppdatere invitasjon.", 500, { code: "INVITE_UPDATE_FAILED", detail: upd1.error });

      if (action === "resend") {
        const sent = await sendInviteEmail(email, link);
        if (sent.ok === false) {
          await admin.from("employee_invites").update({ token_hash: oldHash }).eq("id", inviteId).eq("company_id", companyId);
          return jsonErr(rid, "Kunne ikke sende e-post. Ingenting ble lagret.", 500, { code: "EMAIL_SEND_FAILED", detail: {
            message: sent.error,
          } });
        }
      }

      const upd2 = await admin
        .from("employee_invites")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", inviteId)
        .eq("company_id", companyId);

      if (upd2.error) {
        return jsonOk(a.ctx.rid, {
          status: action === "resend" ? "resent" : "link_ready",
          link,
          warning: "last_sent_at kunne ikke oppdateres.",
        });
      }

      return jsonOk(a.ctx.rid, { status: action === "resend" ? "resent" : "link_ready", link });
    }

    return jsonErr(rid, "Ugyldig action.", 400, "BAD_REQUEST");
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.invites.delete", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(scope.companyId);
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const inviteId = safeUUID(ctx?.params?.id);
  if (!inviteId) return jsonErr(rid, "Ugyldig inviteId.", 400, "INVALID_INVITE_ID");

  try {
    const admin = supabaseAdmin();
    const revoked = await revokeInvite(admin, companyId, inviteId);
    if (!revoked.ok) return jsonErr(rid, "Kunne ikke trekke tilbake invitasjonen.", 500, { code: "REVOKE_FAILED", detail: revoked.error });
    return jsonOk(a.ctx.rid, { status: "revoked" });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}


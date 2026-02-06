// app/api/auth/forgot-password/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { readJson } from "@/lib/http/routeGuard";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function getAppUrl(req: NextRequest) {
  const env =
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  if (env) {
    const u = env.startsWith("http") ? env : `https://${env}`;
    return u.replace(/\/+$/, "");
  }

  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/+$/, "");
  return "http://localhost:3000";
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

async function sendResetEmail(opts: { to: string; link: string }) {
  const cfg = smtpConfig();
  if (cfg.ok === false) return { ok: false as const, error: cfg.error };

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const subject = "Tilbakestill passordet ditt i Lunchportalen";
  const text =
    "Hei,\n" +
    "Du ba om å tilbakestille passordet ditt i Lunchportalen.\n\n" +
    "Bruk lenken under for å velge nytt passord:\n" +
    `${opts.link}\n\n` +
    "Lenken er gyldig i 30 minutter. Hvis du ikke ba om dette, kan du se bort fra e-posten.\n\n" +
    "Vennlig hilsen\n" +
    "Lunchportalen";

  try {
    await transport.sendMail({ from: cfg.from, to: opts.to, subject, text });
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message ?? e ?? "Email send failed") };
  }
}

function isIgnorableUserError(error: unknown) {
  const msg = String((error as { message?: unknown })?.message ?? error ?? "").toLowerCase();
  return msg.includes("user not found") || msg.includes("not found");
}

export async function POST(req: NextRequest) {
  const rid = makeRid();

  try {
    const body = await readJson(req);
    const email = normEmail(body?.email);

    if (!email || !isEmail(email)) {
      return jsonOk(rid, { sent: true }, 200);
    }

    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin();
    const appUrl = getAppUrl(req);
    const redirectTo = `${appUrl}/reset-password`;

    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (error) {
      if (isIgnorableUserError(error)) {
        return jsonOk(rid, { sent: true }, 200);
      }
      return jsonErr(rid, "Kunne ikke sende lenke.", 500, { code: "RECOVERY_LINK_FAILED" });
    }

    const actionLink =
      (data as { properties?: { action_link?: string | null } | null })?.properties?.action_link ??
      (data as { action_link?: string | null })?.action_link ??
      null;

    if (!actionLink) {
      return jsonErr(rid, "Kunne ikke sende lenke.", 500, { code: "RECOVERY_LINK_MISSING" });
    }

    const sent = await sendResetEmail({ to: email, link: actionLink });
    if (sent.ok === false) {
      return jsonErr(rid, "Kunne ikke sende lenke.", 500, { code: "EMAIL_SEND_FAILED" });
    }

    return jsonOk(rid, { sent: true }, 200);
  } catch {
    return jsonErr(rid, "Kunne ikke sende lenke.", 500, { code: "FORGOT_PASSWORD_FAILED" });
  }
}

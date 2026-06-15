// app/api/auth/forgot-password/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { readJson } from "@/lib/http/routeGuard";
import { sendMail } from "@/lib/orderBackup/smtp";
import { opsLog } from "@/lib/ops/log";
import { RESEND_DEFAULT_FROM_ORDER } from "@/lib/system/emails";
import { getPasswordResetRedirectUrl } from "@/lib/url/appUrl";
import {
  describeRedirectTo,
  normalizeRecoveryActionLink,
} from "@/lib/auth/recoveryActionLink";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function resetMailFrom(): string {
  return (
    process.env.LP_SMTP_FROM ||
    process.env.SMTP_FROM ||
    process.env.LP_RESEND_FROM ||
    RESEND_DEFAULT_FROM_ORDER
  );
}

async function sendResetEmail(opts: { to: string; link: string; rid: string }) {
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
    await sendMail({ from: resetMailFrom(), to: opts.to, subject, text });
    return { ok: true as const };
  } catch (e: unknown) {
    const error = String((e as { message?: unknown })?.message ?? e ?? "Email send failed");
    opsLog("auth.forgot_password_email_failed", { rid: opts.rid, error: error.slice(0, 200) });
    return { ok: false as const, error };
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
    const requestHost =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      req.headers.get("host")?.split(",")[0]?.trim() ||
      null;
    const redirectTo = getPasswordResetRedirectUrl({ requestHost });

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

    const normalizedLink = normalizeRecoveryActionLink(actionLink, redirectTo);
    const linkDiag = describeRedirectTo(normalizedLink);
    if (linkDiag.isLocalhost) {
      opsLog("auth.forgot_password_redirect_localhost", {
        rid,
        intendedRedirectTo: redirectTo,
        redirectToFromLink: linkDiag.redirectTo,
      });
      return jsonErr(rid, "Kunne ikke sende lenke.", 500, { code: "RECOVERY_REDIRECT_LOCALHOST" });
    }

    const sent = await sendResetEmail({ to: email, link: normalizedLink, rid });
    if (sent.ok === false) {
      return jsonErr(rid, "Kunne ikke sende lenke.", 500, { code: "EMAIL_SEND_FAILED" });
    }

    return jsonOk(rid, { sent: true }, 200);
  } catch {
    return jsonErr(rid, "Kunne ikke sende lenke.", 500, { code: "FORGOT_PASSWORD_FAILED" });
  }
}

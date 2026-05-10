// Canonical superadmin publish: PENDING ledger-avtale -> ACTIVE via lp_agreement_approve_active.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Ctx = {
  params: { agreementId: string } | Promise<{ agreementId: string }>;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

async function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function appBaseUrl(req: NextRequest) {
  const env = safeStr(process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL);
  if (env) return env.startsWith("http") ? env.replace(/\/+$/, "") : `https://${env}`.replace(/\/+$/, "");
  return req.nextUrl.origin.replace(/\/+$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const g = await scopeOr401(req);
  if (g.ok === false) return g.response;

  const deny = requireRoleOr403(g.ctx, "superadmin.agreements.approve", ["superadmin"]);
  if (deny) return deny;

  const rid = g.ctx.rid;

  try {
    const params = await Promise.resolve(ctx.params as any);
    const agreementId = safeStr(params?.agreementId);
    if (!agreementId) return jsonErr(rid, "Ugyldig avtale.", 400, "BAD_INPUT");

    const actorUserId = safeStr(g.ctx.scope.userId) || null;
    const admin = supabaseAdmin();
    const { data, error } = await admin.rpc("lp_agreement_approve_active", {
      p_agreement_id: agreementId,
      p_actor_user_id: actorUserId,
    });

    if (error) {
      const message = safeStr(error.message).toUpperCase();
      if (message.includes("AGREEMENT_NOT_FOUND")) return jsonErr(rid, "Fant ikke avtale.", 404, "AGREEMENT_NOT_FOUND");
      if (message.includes("AGREEMENT_NOT_PENDING")) return jsonErr(rid, "Avtalen er ikke i status Venter.", 409, "AGREEMENT_NOT_PENDING");
      if (message.includes("REGISTRATION_NOT_FOUND")) return jsonErr(rid, "Fant ikke firmaregistrering.", 404, "REGISTRATION_NOT_FOUND");
      return jsonErr(rid, "Kunne ikke godkjenne avtalen.", 500, "AGREEMENT_APPROVE_FAILED");
    }

    const out = (data ?? {}) as Record<string, unknown>;
    const companyId = safeStr(out.company_id);
    const contactEmail = safeStr(out.contact_email).toLowerCase();
    const contactName = safeStr(out.contact_name) || "kunde";
    if (!companyId || !contactEmail) {
      return jsonErr(rid, "Godkjenning manglet kontaktdata.", 500, "AGREEMENT_APPROVE_BAD_RESPONSE");
    }

    const { data: companyRow } = await admin.from("companies").select("name").eq("id", companyId).maybeSingle();
    const companyName = safeStr((companyRow as any)?.name) || "firmaet";
    const token = crypto.randomUUID();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    const inviteLink = `${appBaseUrl(req)}/registrer-bruker?token=${encodeURIComponent(token)}`;

    await admin.from("company_invites").update({ revoked_at: new Date().toISOString() }).eq("company_id", companyId).is("revoked_at", null);

    const inviteRes = await admin.from("company_invites").insert({
      company_id: companyId,
      token_hash: tokenHash,
      contact_email: contactEmail,
      contact_name: contactName,
      email: contactEmail,
      role: "company_admin",
      expires_at: expiresAt,
      created_by: actorUserId,
    });
    if (inviteRes.error) {
      return jsonErr(rid, "Avtalen ble godkjent, men invitasjon kunne ikke opprettes.", 500, {
        code: "COMPANY_INVITE_CREATE_FAILED",
        detail: { message: inviteRes.error.message },
      });
    }

    const subject = "Velkommen til Lunchportalen - fullfør opprettelsen av din konto";
    const bodyText =
      `Hei ${contactName},\n\n` +
      `Vi er glad for å informere deg om at avtalen for ${companyName}\n` +
      `er godkjent!\n\n` +
      `For å komme i gang trenger du å opprette din innlogging.\n` +
      `Klikk på lenken nedenfor for å fullføre registreringen:\n\n` +
      `${inviteLink}\n\n` +
      `Lenken er gyldig i 7 dager.\n\n` +
      `Har du spørsmål? Svar på denne e-posten så hjelper vi deg.\n\n` +
      `Med vennlig hilsen,\n` +
      `Lunchportalen-teamet`;
    const bodyHtml =
      `<p>Hei ${escapeHtml(contactName)},</p>` +
      `<p>Vi er glad for å informere deg om at avtalen for ${escapeHtml(companyName)} er godkjent!</p>` +
      `<p>For å komme i gang trenger du å opprette din innlogging. Klikk på lenken nedenfor for å fullføre registreringen:</p>` +
      `<p><a href="${escapeHtml(inviteLink)}">AKTIVER KONTO</a></p>` +
      `<p>Lenken er gyldig i 7 dager.</p>` +
      `<p>Har du spørsmål? Svar på denne e-posten så hjelper vi deg.</p>` +
      `<p>Med vennlig hilsen,<br />Lunchportalen-teamet</p>`;

    const outboxRes = await admin.from("outbox").upsert(
      {
        event_key: `company.approved:${agreementId}`,
        payload: {
          event: "company.approved",
          type: "company.approved",
          from: "Lunchportalen <no-reply@lunchportalen.no>",
          to: contactEmail,
          subject,
          bodyText,
          bodyHtml,
          invite_link: inviteLink,
          company_id: companyId,
          agreement_id: agreementId,
        },
        status: "PENDING",
        attempts: 0,
      },
      { onConflict: "event_key" },
    );
    if (outboxRes.error) {
      return jsonErr(rid, "Avtalen ble godkjent, men e-post kunne ikke legges i outbox.", 500, {
        code: "APPROVAL_OUTBOX_FAILED",
        detail: { message: outboxRes.error.message },
      });
    }

    return jsonOk(rid, { companyId, agreementId }, 200);
  } catch {
    return jsonErr(rid, "Kunne ikke godkjenne avtalen.", 500, "AGREEMENT_APPROVE_UNEXPECTED");
  }
}

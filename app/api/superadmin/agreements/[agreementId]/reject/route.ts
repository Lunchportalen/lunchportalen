export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Canonical ledger-reject (public.agreements PENDING → REJECTED).
 * Gate: scopeOr401 → requireRoleOr403(..., ["superadmin"]) — ingen andre roller.
 * Mutasjon: runLedgerAgreementReject → RPC lp_agreement_reject_pending (service_role).
 */
import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Ctx = {
  params: { agreementId: string } | Promise<{ agreementId: string }>;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
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

  const deny = requireRoleOr403(g.ctx, "superadmin.agreements.reject", ["superadmin"]);
  if (deny) return deny;

  const rid = g.ctx.rid;

  try {
    const params = await Promise.resolve(ctx.params as any);
    const agreementId = safeStr(params?.agreementId);
    const body = (await readJson(req)) as { reason?: unknown };
    const reason = body?.reason != null ? safeStr(body.reason) : null;
    if (!agreementId) return jsonErr(rid, "Ugyldig avtale.", 400, "BAD_INPUT");

    const admin = supabaseAdmin();
    const { data, error } = await admin.rpc("lp_agreement_reject_pending", {
      p_agreement_id: agreementId,
      p_actor_user_id: safeStr(g.ctx.scope.userId) || null,
      p_reason: reason || null,
    });

    if (error) {
      const message = safeStr(error.message).toUpperCase();
      if (message.includes("AGREEMENT_NOT_FOUND")) return jsonErr(rid, "Fant ikke avtale.", 404, "AGREEMENT_NOT_FOUND");
      if (message.includes("AGREEMENT_NOT_PENDING")) return jsonErr(rid, "Avtalen er ikke i status Venter.", 409, "AGREEMENT_NOT_PENDING");
      if (message.includes("REGISTRATION_NOT_FOUND")) return jsonErr(rid, "Fant ikke firmaregistrering.", 404, "REGISTRATION_NOT_FOUND");
      return jsonErr(rid, "Kunne ikke avslå avtalen.", 500, "AGREEMENT_REJECT_FAILED");
    }

    const out = (data ?? {}) as Record<string, unknown>;
    const companyId = safeStr(out.company_id);
    const contactEmail = safeStr(out.contact_email).toLowerCase();
    const contactName = safeStr(out.contact_name) || "kunde";
    if (!companyId || !contactEmail) {
      return jsonErr(rid, "Avslag manglet kontaktdata.", 500, "AGREEMENT_REJECT_BAD_RESPONSE");
    }

    const { data: companyRow } = await admin.from("companies").select("name").eq("id", companyId).maybeSingle();
    const companyName = safeStr((companyRow as any)?.name) || "firmaet";
    const subject = "Tilbakemelding på din søknad til Lunchportalen";
    const bodyText =
      `Hei ${contactName},\n\n` +
      `Takk for at du meldte interesse for Lunchportalen og tok deg\n` +
      `tid til å sende inn en søknad for ${companyName}.\n\n` +
      `Vi setter stor pris på tilliten du har vist oss. Dessverre\n` +
      `må vi meddele at vi ikke har mulighet til å ta inn nye\n` +
      `kunder på nåværende tidspunkt.\n\n` +
      `Dette er ikke en vurdering av din bedrift - vi jobber\n` +
      `kontinuerlig med å utvide kapasiteten vår, og vi håper\n` +
      `å kunne ønske deg velkommen ved en senere anledning.\n\n` +
      `Vi ønsker deg og ${companyName} alt godt videre.\n\n` +
      `Med vennlig hilsen,\n` +
      `Lunchportalen-teamet`;
    const bodyHtml =
      `<p>Hei ${escapeHtml(contactName)},</p>` +
      `<p>Takk for at du meldte interesse for Lunchportalen og tok deg tid til å sende inn en søknad for ${escapeHtml(companyName)}.</p>` +
      `<p>Vi setter stor pris på tilliten du har vist oss. Dessverre må vi meddele at vi ikke har mulighet til å ta inn nye kunder på nåværende tidspunkt.</p>` +
      `<p>Dette er ikke en vurdering av din bedrift - vi jobber kontinuerlig med å utvide kapasiteten vår, og vi håper å kunne ønske deg velkommen ved en senere anledning.</p>` +
      `<p>Vi ønsker deg og ${escapeHtml(companyName)} alt godt videre.</p>` +
      `<p>Med vennlig hilsen,<br />Lunchportalen-teamet</p>`;

    const outboxRes = await admin.from("outbox").upsert(
      {
        event_key: `company.rejected:${agreementId}`,
        payload: {
          event: "company.rejected",
          type: "company.rejected",
          from: "Lunchportalen <no-reply@lunchportalen.no>",
          to: contactEmail,
          subject,
          bodyText,
          bodyHtml,
          company_id: companyId,
          agreement_id: agreementId,
        },
        status: "PENDING",
        attempts: 0,
      },
      { onConflict: "event_key" },
    );
    if (outboxRes.error) {
      return jsonErr(rid, "Avtalen ble avslått, men e-post kunne ikke legges i outbox.", 500, {
        code: "REJECTION_OUTBOX_FAILED",
        detail: { message: outboxRes.error.message },
      });
    }

    return jsonOk(rid, { companyId, agreementId }, 200);
  } catch {
    return jsonErr(rid, "Kunne ikke avslå avtalen.", 500, "AGREEMENT_REJECT_UNEXPECTED");
  }
}

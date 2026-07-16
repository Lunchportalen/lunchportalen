export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import crypto from "node:crypto";
import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inviteExpiresAtIso } from "@/lib/invites/employeeInviteConstants";
import { providerSlugWithSuffix } from "@/lib/providers/providerRegistrationSlug";
import { buildProviderAdminInviteEmail } from "@/lib/email/templates/providerAdminInvite";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function appBaseUrl(req: NextRequest) {
  const env = safeStr(process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL);
  return env || new URL(req.url).origin;
}
function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rid = makeRid("prov_reg_approve");
  const { requireSuperadminApi } = await import("@/lib/superadmin/auth");
  const guard = await requireSuperadminApi();
  if (guard.ok === false) {
    return jsonErr(rid, guard.message, guard.status, guard.status === 401 ? "NOT_AUTHENTICATED" : "FORBIDDEN");
  }

  const params = "then" in ctx.params ? await ctx.params : ctx.params;
  const registrationId = safeStr(params.id);
  if (!isUuid(registrationId)) return jsonErr(rid, "Ugyldig ID.", 400, "BAD_ID");

  const admin = supabaseAdmin();

  const { data: reg, error: regErr } = await (admin as any)
    .from("provider_registrations")
    .select("id, status, company_name, contact_name, contact_email, invoice_language, operating_language")
    .eq("id", registrationId)
    .maybeSingle();
  if (regErr) return jsonErr(rid, "Kunne ikke lese søknaden.", 500, "READ_FAILED");
  if (!reg) return jsonErr(rid, "Søknaden finnes ikke.", 404, "NOT_FOUND");

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const slug = providerSlugWithSuffix(safeStr(reg.company_name), registrationId.slice(0, 6));
  const expiresAt = inviteExpiresAtIso();

  const { data: approveData, error: approveErr } = await (admin as any).rpc("lp_provider_registration_approve", {
    p_registration_id: registrationId,
    p_slug: slug,
    p_token_hash: tokenHash,
    p_invite_expires_at: expiresAt,
    p_actor_user_id: guard.userId,
  });

  if (approveErr) {
    const raw = String(approveErr.message ?? "").toUpperCase();
    if (raw.includes("REGISTRATION_NOT_PENDING")) return jsonErr(rid, "Søknaden er allerede behandlet.", 409, "NOT_PENDING");
    if (raw.includes("ORG_NUMBER_IS_CUSTOMER")) return jsonErr(rid, "Organisasjonsnummeret tilhører allerede et lunsjfirma (kunde) og kan ikke bli leverandør.", 409, "ORG_NUMBER_IS_CUSTOMER");
    if (raw.includes("SLUG_ALREADY_EXISTS") || raw.includes("NAME_ALREADY_EXISTS") || raw.includes("ORG_NUMBER_ALREADY_EXISTS"))
      return jsonErr(rid, "En leverandør med samme identitet finnes allerede.", 409, "PROVIDER_EXISTS");
    return jsonErr(rid, "Kunne ikke godkjenne søknaden.", 500, "APPROVE_FAILED", { detail: approveErr.message });
  }

  const providerId = safeStr((approveData as { provider_id?: string } | null)?.provider_id);
  const idempotent = Boolean((approveData as { idempotent?: boolean } | null)?.idempotent);

  if (!idempotent && providerId) {
    // Invite email in the recipient's chosen language (invoice/operating locale).
    const activateUrl = `${appBaseUrl(req).replace(/\/$/, "")}/registrer-leverandor?token=${rawToken}`;
    const { subject, html, text } = buildProviderAdminInviteEmail({
      contactName: safeStr(reg.contact_name) || safeStr(reg.contact_email),
      companyName: safeStr(reg.company_name),
      activateUrl,
      locale: safeStr(reg.invoice_language) || safeStr(reg.operating_language) || "nb",
    });
    try {
      await admin.from("outbox").upsert(
        {
          event_key: `provider.approved:${registrationId}`,
          payload: {
            event: "provider.approved",
            type: "provider.approved",
            from: "Lunchportalen <no-reply@lunchportalen.no>",
            to: safeStr(reg.contact_email),
            subject,
            bodyText: text,
            bodyHtml: html,
            invite_link: activateUrl,
            provider_id: providerId,
            registration_id: registrationId,
          },
          status: "PENDING",
          attempts: 0,
        },
        { onConflict: "event_key" },
      );
    } catch {
      // non-fatal: invite row exists; email can be resent
    }

    // Sanity provider mapping — DRAFT only (no auto-publish).
    try {
      const { syncProviderToSanityDraft } = await import("@/lib/cms/syncProviderToSanityDraft");
      await syncProviderToSanityDraft(providerId);
    } catch {
      // non-fatal: mapping can be re-run; never blocks approval
    }

    try {
      const { auditLog } = await import("@/lib/audit/log");
      auditLog({
        action: "PROVIDER_REGISTRATION_APPROVED",
        userId: guard.userId,
        role: "superadmin",
        companyId: null,
        locationId: null,
        resource: "provider_registration",
        resourceId: registrationId,
        metadata: { rid, providerId, slug },
        timestamp: Date.now(),
        rid,
      });
    } catch {
      // audit best-effort
    }
  }

  return jsonOk(rid, { provider_id: providerId, slug, idempotent, status: "APPROVED" }, 200);
}

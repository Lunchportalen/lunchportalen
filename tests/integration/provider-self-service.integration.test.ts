/**
 * PHASE 4 — provider self-service registration + bootstrap (staging integration).
 *
 * Proves the RPC chain against real Postgres (staging uigx):
 *   lp_provider_registration_create → lp_provider_registration_approve
 *   (atomic providers + organizations + provider_settings + provider_invite)
 *   → lp_provider_admin_invite_accept (profile + provider_membership) + reject.
 *
 * Requires RUN_SUPABASE_INTEGRATION_TESTS=1 + staging env.
 */
// @ts-nocheck
import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { closeFixturePgPool, fixturePgQuery, fixturePgTransaction } from "../_helpers/fixturePg";
import { hasRemoteSupabaseIntegrationEnv } from "../_helpers/remoteSupabaseIntegration";
import { serviceRoleClient } from "../_helpers/supabaseTestClient";

const RUN = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });
const d = RUN ? describe : describe.skip;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const rand = () => crypto.randomUUID().slice(0, 8);

d("provider self-service registration + bootstrap (staging)", () => {
  const admin = RUN ? serviceRoleClient() : (null as never);
  const createdRegIds: string[] = [];
  const createdProviderIds: string[] = [];
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (!RUN) return;
    await fixturePgTransaction([
      { text: `set local session_replication_role = replica` },
      { text: `delete from public.provider_memberships where user_id = any($1::uuid[])`, values: [createdUserIds] },
      { text: `delete from public.profiles where id = any($1::uuid[])`, values: [createdUserIds] },
      { text: `delete from public.provider_invites where provider_id = any($1::uuid[])`, values: [createdProviderIds] },
      { text: `delete from public.provider_settings where provider_id = any($1::uuid[])`, values: [createdProviderIds] },
      { text: `delete from public.organizations where id = any($1::uuid[])`, values: [createdProviderIds] },
      { text: `update public.provider_registrations set provider_id = null where id = any($1::uuid[])`, values: [createdRegIds] },
      { text: `delete from public.providers where id = any($1::uuid[])`, values: [createdProviderIds] },
      { text: `delete from public.provider_registrations where id = any($1::uuid[])`, values: [createdRegIds] },
    ]);
    for (const id of createdUserIds) {
      try {
        await admin.auth.admin.deleteUser(id);
      } catch {
        /* ignore */
      }
    }
    await closeFixturePgPool();
  }, 120_000);

  async function createRegistration(overrides: Record<string, unknown> = {}) {
    const email = `prov.${rand()}@test.lunchportalen.no`;
    const payload = {
      company_name: `Test Catering ${rand()}`,
      org_number: `9${Math.floor(Math.random() * 90000000 + 10000000)}`,
      country_code: "NO",
      contact_name: "Kari Kokk",
      contact_email: email,
      operating_language: "nb",
      invoice_language: "nb",
      currency: "NOK",
      ...overrides,
    };
    const { data, error } = await admin.rpc("lp_provider_registration_create", { p_payload: payload });
    return { data, error, email, payload };
  }

  it("public registration inserts PENDING and enforces US/CA timezone", async () => {
    const ok = await createRegistration();
    expect(ok.error, ok.error?.message).toBeNull();
    const regId = String(ok.data.registration_id);
    createdRegIds.push(regId);
    expect(ok.data.status).toBe("PENDING");

    // US without timezone → fail-closed.
    const us = await createRegistration({ country_code: "US", currency: "USD", operating_language: "en", invoice_language: "en" });
    expect(String(us.error?.message ?? "")).toContain("TIMEZONE_REQUIRED_FOR_MARKET");

    // US with timezone → ok.
    const usOk = await createRegistration({ country_code: "US", currency: "USD", operating_language: "en", invoice_language: "en", timezone: "America/New_York" });
    expect(usOk.error).toBeNull();
    createdRegIds.push(String(usOk.data.registration_id));
  }, 120_000);

  it("duplicate pending registration is rejected", async () => {
    const first = await createRegistration();
    expect(first.error).toBeNull();
    createdRegIds.push(String(first.data.registration_id));
    const dup = await createRegistration({ contact_email: first.email, org_number: first.payload.org_number });
    expect(String(dup.error?.message ?? "")).toContain("PENDING_REGISTRATION_EXISTS");
  }, 120_000);

  it("approve creates provider + organization + settings + invite atomically; accept binds provider_admin", async () => {
    const reg = await createRegistration({ order_email: `kitchen.${rand()}@test.lunchportalen.no`, tax_registration: "NO999888777MVA" });
    expect(reg.error).toBeNull();
    const regId = String(reg.data.registration_id);
    createdRegIds.push(regId);

    const rawToken = crypto.randomBytes(24).toString("hex");
    const slug = `test-catering-${rand()}`;
    const approve = await admin.rpc("lp_provider_registration_approve", {
      p_registration_id: regId,
      p_slug: slug,
      p_token_hash: sha256(rawToken),
      p_invite_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
      p_actor_user_id: null,
    });
    expect(approve.error, approve.error?.message).toBeNull();
    const providerId = String(approve.data.provider_id);
    createdProviderIds.push(providerId);

    // Atomic bootstrap: provider + organization + settings all exist.
    const { data: prov } = await admin.from("providers").select("id, slug, status, billing_model").eq("id", providerId).maybeSingle();
    expect(String(prov?.slug)).toBe(slug);
    expect(String(prov?.status)).toBe("ACTIVE");

    const { data: org } = await admin.from("organizations").select("id, type").eq("id", providerId).maybeSingle();
    expect(String(org?.type)).toBe("provider");

    const { data: settings } = await admin
      .from("provider_settings")
      .select("provider_id, default_currency, default_country_code, invoice_language, tax_registration, timezone")
      .eq("provider_id", providerId)
      .maybeSingle();
    expect(String(settings?.default_currency)).toBe("NOK");
    expect(String(settings?.invoice_language)).toBe("nb");
    expect(String(settings?.tax_registration)).toBe("NO999888777MVA");
    expect(String(settings?.timezone)).toBe("Europe/Oslo");

    // Registration marked APPROVED with provider_id.
    const { data: regRow } = await admin.from("provider_registrations").select("status, provider_id").eq("id", regId).maybeSingle();
    expect(String(regRow?.status)).toBe("APPROVED");
    expect(String(regRow?.provider_id)).toBe(providerId);

    // Idempotent approve.
    const again = await admin.rpc("lp_provider_registration_approve", {
      p_registration_id: regId, p_slug: slug, p_token_hash: sha256(rawToken), p_invite_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(), p_actor_user_id: null,
    });
    expect(again.error).toBeNull();
    expect(again.data.idempotent).toBe(true);

    // First provider_admin accepts.
    const { data: created } = await admin.auth.admin.createUser({ email: reg.email, password: crypto.randomBytes(18).toString("hex"), email_confirm: true });
    const userId = String(created.user.id);
    createdUserIds.push(userId);
    for (let i = 0; i < 25; i += 1) {
      const { data: p } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (p?.id) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const accept = await admin.rpc("lp_provider_admin_invite_accept", {
      p_user_id: userId, p_token_hash: sha256(rawToken), p_email: reg.email, p_full_name: "Kari Kokk",
    });
    expect(accept.error, accept.error?.message).toBeNull();
    expect(String(accept.data.provider_id)).toBe(providerId);

    const { data: prof } = await admin.from("profiles").select("role, company_id").eq("id", userId).maybeSingle();
    expect(String(prof?.role)).toBe("provider_admin");
    expect(prof?.company_id).toBeNull();

    const { data: mem } = await admin.from("provider_memberships").select("role").eq("user_id", userId).eq("provider_id", providerId).maybeSingle();
    expect(String(mem?.role)).toBe("provider_admin");

    // Wrong email cannot accept.
    const wrong = await admin.rpc("lp_provider_admin_invite_accept", {
      p_user_id: userId, p_token_hash: sha256(rawToken), p_email: `attacker.${rand()}@test.lunchportalen.no`, p_full_name: null,
    });
    expect(String(wrong.error?.message ?? "")).toContain("INVITE_EMAIL_MISMATCH");
  }, 180_000);

  it("reject moves a PENDING registration to REJECTED", async () => {
    const reg = await createRegistration();
    expect(reg.error).toBeNull();
    const regId = String(reg.data.registration_id);
    createdRegIds.push(regId);
    const rej = await admin.rpc("lp_provider_registration_reject", { p_registration_id: regId, p_reason: "Utenfor område", p_actor_user_id: null });
    expect(rej.error).toBeNull();
    const { data: row } = await admin.from("provider_registrations").select("status").eq("id", regId).maybeSingle();
    expect(String(row?.status)).toBe("REJECTED");
  }, 120_000);

  it("provider cannot become a customer of itself (org already a company)", async () => {
    // Seed a customer company with a known orgnr, then try to approve a provider
    // registration carrying the same orgnr.
    const orgnr = `9${Math.floor(Math.random() * 90000000 + 10000000)}`;
    const companyId = crypto.randomUUID();
    await fixturePgQuery(
      `insert into public.companies (id, name, status, orgnr, provider_id)
       values ($1, $2, 'ACTIVE', $3, '11111111-1111-1111-1111-111111111111'::uuid)`,
      [companyId, `Self Customer ${rand()}`, orgnr],
    );
    try {
      const reg = await createRegistration({ org_number: orgnr });
      expect(reg.error).toBeNull();
      const regId = String(reg.data.registration_id);
      createdRegIds.push(regId);
      const approve = await admin.rpc("lp_provider_registration_approve", {
        p_registration_id: regId, p_slug: `self-${rand()}`, p_token_hash: sha256(crypto.randomBytes(16).toString("hex")), p_invite_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(), p_actor_user_id: null,
      });
      expect(String(approve.error?.message ?? "")).toContain("ORG_NUMBER_IS_CUSTOMER");
    } finally {
      await fixturePgQuery(`delete from public.companies where id = $1`, [companyId]);
    }
  }, 120_000);
});

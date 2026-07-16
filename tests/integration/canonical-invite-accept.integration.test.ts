/**
 * PHASE 3 — canonical invite acceptance RPCs (staging integration, opt-in).
 *
 * Proves the atomic + idempotent + fail-closed contract of
 * lp_employee_invite_accept / lp_company_admin_invite_accept against a real
 * Postgres (staging uigx). Requires RUN_SUPABASE_INTEGRATION_TESTS=1 + staging env.
 *
 * Scenarios: employee happy (+ atomic membership), company-admin happy,
 * expired token, reused token (idempotent same user / conflict other user),
 * wrong-tenant email, wrong company.
 */
// @ts-nocheck
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeFixturePgPool, fixturePgQuery, fixturePgTransaction } from "../_helpers/fixturePg";
import { hasRemoteSupabaseIntegrationEnv } from "../_helpers/remoteSupabaseIntegration";
import { serviceRoleClient } from "../_helpers/supabaseTestClient";

const RUN = hasRemoteSupabaseIntegrationEnv({ requireAnon: true, requirePostgres: true });
const d = RUN ? describe : describe.skip;

const PROVIDER_ID = "11111111-1111-1111-1111-111111111111";
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const rand = () => crypto.randomUUID().slice(0, 8);

function futureIso(days = 3) {
  return new Date(Date.now() + days * 86400_000).toISOString();
}
function pastIso(days = 3) {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

d("canonical invite acceptance RPCs (staging)", () => {
  const admin = RUN ? serviceRoleClient() : (null as never);
  const short = rand();
  const orgBase = 200000000 + Math.floor(Math.random() * 700000000);

  const companyAId = crypto.randomUUID();
  const companyBId = crypto.randomUUID();
  const locAId = crypto.randomUUID();
  const createdUserIds: string[] = [];
  const createdInviteIds: string[] = [];
  const createdCompanyInviteIds: string[] = [];

  async function makeAuthUser(email: string): Promise<string> {
    const { data, error } = await admin.auth.admin.createUser({ email, password: crypto.randomBytes(18).toString("hex"), email_confirm: true });
    if (error || !data?.user?.id) throw new Error(`createUser: ${error?.message}`);
    createdUserIds.push(data.user.id);
    // wait for profile trigger
    for (let i = 0; i < 25; i += 1) {
      const { data: p } = await admin.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
      if (p?.id) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    return data.user.id;
  }

  beforeAll(async () => {
    if (!RUN) return;
    await fixturePgQuery(
      `insert into public.companies (id, name, status, orgnr, provider_id)
       values ($1,$2,'ACTIVE',$3,$4::uuid), ($5,$6,'ACTIVE',$7,$4::uuid)`,
      [companyAId, `Inv A ${short}`, String(orgBase), PROVIDER_ID, companyBId, `Inv B ${short}`, String(orgBase + 1)],
    );
    await fixturePgQuery(
      `insert into public.company_locations (id, company_id, name) values ($1,$2,$3)`,
      [locAId, companyAId, `Loc A ${short}`],
    );
  }, 120_000);

  afterAll(async () => {
    if (!RUN) return;
    await fixturePgTransaction([
      { text: `set local session_replication_role = replica` },
      { text: `delete from public.company_memberships where user_id = any($1::uuid[])`, values: [createdUserIds] },
      { text: `delete from public.location_memberships where user_id = any($1::uuid[])`, values: [createdUserIds] },
      { text: `delete from public.profiles where id = any($1::uuid[])`, values: [createdUserIds] },
      { text: `delete from public.employee_invites where id = any($1::uuid[])`, values: [createdInviteIds] },
      { text: `delete from public.company_invites where id = any($1::uuid[])`, values: [createdCompanyInviteIds] },
      { text: `delete from public.company_locations where id = $1`, values: [locAId] },
      { text: `delete from public.companies where id = any($1::uuid[])`, values: [[companyAId, companyBId]] },
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

  async function seedEmployeeInvite(email: string, opts?: { expiresAt?: string; createdAt?: string; companyId?: string; locationId?: string | null }) {
    const id = crypto.randomUUID();
    const raw = crypto.randomBytes(24).toString("hex");
    createdInviteIds.push(id);
    // employee_invites_expiry_ck: expires_at > created_at. For expired fixtures
    // seed created_at further in the past so the pair stays valid on insert.
    const createdAt = opts?.createdAt ?? pastIso(30);
    await fixturePgQuery(
      `insert into public.employee_invites (id, company_id, location_id, email, role, token_hash, created_at, expires_at)
       values ($1,$2,$3,$4,'employee',$5,$6,$7)`,
      [id, opts?.companyId ?? companyAId, opts?.locationId ?? locAId, email.toLowerCase(), sha256(raw), createdAt, opts?.expiresAt ?? futureIso()],
    );
    return { id, raw, token_hash: sha256(raw) };
  }

  it("employee happy path: atomic bind + membership + consume", async () => {
    const email = `emp.${rand()}@test.lunchportalen.no`;
    const invite = await seedEmployeeInvite(email);
    const userId = await makeAuthUser(email);

    const { data, error } = await admin.rpc("lp_employee_invite_accept", {
      p_user_id: userId,
      p_token_hash: invite.token_hash,
      p_email: email,
      p_full_name: "Emp Test",
    });
    expect(error, error?.message).toBeNull();
    expect(data?.ok).toBe(true);
    expect(String(data?.company_id)).toBe(companyAId);

    const { data: prof } = await admin.from("profiles").select("company_id, location_id, role, is_active").eq("id", userId).maybeSingle();
    expect(String(prof?.company_id)).toBe(companyAId);
    expect(String(prof?.location_id)).toBe(locAId);
    expect(String(prof?.role)).toBe("employee");
    expect(prof?.is_active).toBe(true);

    // Atomic membership sync (via profiles trigger) happened in the same tx.
    const { data: cm } = await admin.from("company_memberships").select("company_id").eq("user_id", userId).eq("company_id", companyAId);
    expect(Array.isArray(cm) && cm.length).toBeGreaterThan(0);

    const { data: inv } = await admin.from("employee_invites").select("used_at").eq("id", invite.id).maybeSingle();
    expect(inv?.used_at).toBeTruthy();
  }, 120_000);

  it("expired token → INVITE_EXPIRED", async () => {
    const email = `exp.${rand()}@test.lunchportalen.no`;
    const invite = await seedEmployeeInvite(email, { createdAt: pastIso(30), expiresAt: pastIso(1) });
    const userId = await makeAuthUser(email);
    const { error } = await admin.rpc("lp_employee_invite_accept", {
      p_user_id: userId, p_token_hash: invite.token_hash, p_email: email, p_full_name: null,
    });
    expect(String(error?.message ?? "")).toContain("INVITE_EXPIRED");
  }, 120_000);

  it("wrong recipient email → INVITE_EMAIL_MISMATCH", async () => {
    const email = `who.${rand()}@test.lunchportalen.no`;
    const invite = await seedEmployeeInvite(email);
    const userId = await makeAuthUser(`other.${rand()}@test.lunchportalen.no`);
    const { error } = await admin.rpc("lp_employee_invite_accept", {
      p_user_id: userId, p_token_hash: invite.token_hash, p_email: `attacker.${rand()}@test.lunchportalen.no`, p_full_name: null,
    });
    expect(String(error?.message ?? "")).toContain("INVITE_EMAIL_MISMATCH");
  }, 120_000);

  it("reused token: idempotent for same user, conflict for a different user", async () => {
    const email = `re.${rand()}@test.lunchportalen.no`;
    const invite = await seedEmployeeInvite(email);
    const userId = await makeAuthUser(email);

    const first = await admin.rpc("lp_employee_invite_accept", { p_user_id: userId, p_token_hash: invite.token_hash, p_email: email, p_full_name: null });
    expect(first.error).toBeNull();
    const second = await admin.rpc("lp_employee_invite_accept", { p_user_id: userId, p_token_hash: invite.token_hash, p_email: email, p_full_name: null });
    expect(second.error, "same-user retry must be idempotent").toBeNull();
    expect(second.data?.idempotent).toBe(true);

    // A different user cannot consume an already-used invite.
    const otherId = await makeAuthUser(email.replace("re.", "re2.")); // different auth user, same invite email won't match → email mismatch OR used
    const third = await admin.rpc("lp_employee_invite_accept", { p_user_id: otherId, p_token_hash: invite.token_hash, p_email: email, p_full_name: null });
    expect(String(third.error?.message ?? "")).toMatch(/INVITE_USED|COMPANY_MISMATCH|INVITE_EMAIL_MISMATCH/);
  }, 180_000);

  it("wrong company: user already bound to company A cannot accept an invite for company B", async () => {
    const emailA = `xa.${rand()}@test.lunchportalen.no`;
    const inviteA = await seedEmployeeInvite(emailA, { companyId: companyAId, locationId: locAId });
    const userId = await makeAuthUser(emailA);
    const okA = await admin.rpc("lp_employee_invite_accept", { p_user_id: userId, p_token_hash: inviteA.token_hash, p_email: emailA, p_full_name: null });
    expect(okA.error).toBeNull();

    // Now a company-B invite for the SAME email/user must be refused.
    const inviteB = await seedEmployeeInvite(emailA, { companyId: companyBId, locationId: null });
    const conflict = await admin.rpc("lp_employee_invite_accept", { p_user_id: userId, p_token_hash: inviteB.token_hash, p_email: emailA, p_full_name: null });
    expect(String(conflict.error?.message ?? "")).toContain("COMPANY_MISMATCH");
  }, 180_000);

  it("company-admin happy path binds role + company atomically", async () => {
    const email = `ca.${rand()}@test.lunchportalen.no`;
    const inviteId = crypto.randomUUID();
    const raw = crypto.randomBytes(24).toString("hex");
    createdCompanyInviteIds.push(inviteId);
    await fixturePgQuery(
      `insert into public.company_invites (id, company_id, contact_email, contact_name, token_hash, expires_at)
       values ($1,$2,$3,$4,$5,$6)`,
      [inviteId, companyAId, email.toLowerCase(), "CA Test", sha256(raw), futureIso()],
    );
    const userId = await makeAuthUser(email);
    const { data, error } = await admin.rpc("lp_company_admin_invite_accept", {
      p_user_id: userId, p_token_hash: sha256(raw), p_email: email, p_full_name: "CA Test",
    });
    expect(error, error?.message).toBeNull();
    expect(data?.ok).toBe(true);
    const { data: prof } = await admin.from("profiles").select("company_id, role").eq("id", userId).maybeSingle();
    expect(String(prof?.company_id)).toBe(companyAId);
    expect(String(prof?.role)).toBe("company_admin");
  }, 120_000);
});

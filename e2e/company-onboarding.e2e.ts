// e2e/company-onboarding.e2e.ts
// PHASE 5 — browser E2E: company onboarding + agreement lifecycle
//   company registers (/registrering, package selected per weekday)
//   → provider matched on actual coverage → plan materialized + agreement
//   approved (canonical superadmin RPC path) → company admin invited →
//   acceptance (/registrer-bruker) → post-login lands /admin →
//   location delivery instructions + billing profile configured →
//   company ACTIVE end-to-end.
// Skips unless staging service env is present.
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

const STAGING_REF = "uigxsboqeruxflgzqztl";
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const RUN = url.includes(STAGING_REF) && Boolean(serviceKey);

// Isolated test postal codes — one per Playwright project, since chromium and
// mobile run this test concurrently and would otherwise both cover the same
// postal code (triggering multi-provider choice unintentionally).
const POSTAL_BY_PROJECT: Record<string, string> = { chromium: "0026", mobile: "0027" };
const CITY = "Testby";

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

test.describe("company onboarding: register → match → approve → invite → configure → active", () => {
  test.skip(!RUN, "staging NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");

  test("full flow ends with active company and configured admin surfaces", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const POSTAL = POSTAL_BY_PROJECT[testInfo.project.name] ?? "0028";

    const runId = crypto.randomUUID().slice(0, 8);
    const companyName = `E2E Lunsjfirma ${runId}`;
    const orgnr = `9${Math.floor(Math.random() * 90000000 + 10000000)}`;
    const email = `e2e-company-${runId}@test.lunchportalen.no`;

    let providerId: string | null = null;
    let areaId: string | null = null;
    let companyId: string | null = null;
    let userId: string | null = null;

    try {
      // 0) Seed provider coverage for the postal code (actual coverage matching).
      providerId = crypto.randomUUID();
      const provIns = await admin.from("providers").insert({
        id: providerId,
        name: `E2E Provider ${runId}`,
        slug: `e2e-provider-${runId}`,
        contact_email: `e2e-prov-${runId}@test.lunchportalen.no`,
        billing_model: "SAAS_FIXED",
        status: "ACTIVE",
      });
      expect(provIns.error, provIns.error?.message).toBeNull();
      areaId = crypto.randomUUID();
      const areaIns = await admin.from("provider_service_areas").insert({
        id: areaId,
        provider_id: providerId,
        country: "NO",
        city: CITY,
        postal_code_from: POSTAL,
        postal_code_to: POSTAL,
        active: true,
      });
      expect(areaIns.error, areaIns.error?.message).toBeNull();

      // 1) COMPANY REGISTERS — public form with weekday package selection.
      await page.goto(`/registrering?postal_code=${POSTAL}&city=${CITY}&source=e2e`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => null);

      // Intro step → open the actual registration form.
      const startBtn = page.getByRole("button", { name: /start som bedriftsadministrator/i });
      await startBtn.waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForTimeout(500);
      await startBtn.click();

      const submit = page.getByRole("button", { name: /send|registrer/i }).last();
      await submit.waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForTimeout(1000);

      // Package selection: Tirsdag = Luxus (rest Basis).
      await page.getByLabel("Tirsdag *").selectOption("LUXUS");
      await page.getByLabel("Levering fra (HH:MM) *").fill("11:00");
      await page.getByLabel("Levering til (HH:MM) *").fill("13:00");
      await page.getByLabel("Firmanavn *").fill(companyName);
      await page.getByLabel("Organisasjonsnummer *").fill(orgnr);
      await page.getByLabel("Antall ansatte *").fill("25");
      await page.getByLabel("Kontaktperson *").fill("E2E Firmaadmin");
      await page.getByLabel("E-post *").fill(email);
      await page.getByLabel("Telefon *").fill("99887766");
      await page.getByLabel("Adresse *").fill("Testveien 1");
      await page.getByLabel("Postnummer *").fill(POSTAL);
      await page.getByLabel("Poststed *").fill(CITY);
      // Controlled provider choice appears only if MULTIPLE providers cover the
      // postal code (e.g. residue from concurrent runs) — pick our provider.
      await page.waitForTimeout(1500);
      const providerSelect = page.locator('select[name="provider_choice"]');
      if (await providerSelect.isVisible().catch(() => false)) {
        await providerSelect.selectOption(providerId!);
      }
      await page.getByRole("checkbox").check();
      await submit.click();
      await expect(page.getByText("Registreringen er mottatt")).toBeVisible({ timeout: 45_000 });

      // 2) PROVIDER MATCHED — company + agreement carry provider_id from start.
      const { data: comp } = await admin
        .from("companies")
        .select("id, status, provider_id, default_location_id")
        .eq("orgnr", orgnr)
        .maybeSingle();
      expect(String(comp?.provider_id)).toBe(providerId);
      expect(String(comp?.status)).toBe("PENDING");
      companyId = String(comp?.id);

      const { data: agr } = await admin
        .from("agreements")
        .select("id, status, provider_id")
        .eq("company_id", companyId)
        .maybeSingle();
      expect(String(agr?.provider_id)).toBe(providerId);
      const agreementId = String(agr?.id);

      // 3) AGREEMENT APPROVED — canonical superadmin path: materialize plan,
      //    approve ACTIVE, then company admin invite token (same as the route).
      const mat = await admin.rpc("lp_agreement_materialize_plan", { p_agreement_id: agreementId });
      expect(mat.error, mat.error?.message).toBeNull();
      expect((mat.data as any).materialized).toBe(true);

      const approve = await admin.rpc("lp_agreement_approve_active", { p_agreement_id: agreementId, p_actor_user_id: null });
      expect(approve.error, approve.error?.message).toBeNull();

      const rawToken = crypto.randomBytes(24).toString("hex");
      const invIns = await admin.from("company_invites").insert({
        company_id: companyId,
        token_hash: sha256(rawToken),
        contact_email: email,
        contact_name: "E2E Firmaadmin",
        email,
        role: "company_admin",
        expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
      });
      expect(invIns.error, invIns.error?.message).toBeNull();

      // 4) COMPANY ADMIN INVITED → ACCEPTANCE in the browser.
      await page.goto(`/registrer-bruker?token=${rawToken}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => null);
      const activate = page.getByRole("button", { name: /aktiver|fullf/i });
      await activate.waitFor({ state: "visible", timeout: 20_000 });
      await page.waitForTimeout(1000);
      const password = `E2e-${crypto.randomBytes(12).toString("base64url")}`;
      await page.locator('input[type="password"]').first().fill(password);
      await page.locator('input[type="password"]').last().fill(password);
      await activate.click();

      // Post-login resolver lands company_admin (active agreement) on /admin.
      await page.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 60_000 });

      const { data: prof } = await admin.from("profiles").select("id, role, company_id").eq("email", email).maybeSingle();
      expect(String(prof?.role)).toBe("company_admin");
      expect(String(prof?.company_id)).toBe(companyId);
      userId = prof?.id ? String(prof.id) : null;

      // 5) LOCATION CONFIGURED — delivery instructions via authenticated API
      //    (same session cookies as the browser).
      const locationId = String(comp?.default_location_id ?? "");
      expect(locationId).toBeTruthy();
      const locRes = await page.request.patch("/api/admin/locations", {
        data: {
          locationId,
          contact_name: "Resepsjonen",
          contact_phone: "22334455",
          window_from: "11:00",
          window_to: "13:00",
          delivery_instructions: "Ring på ved varemottak, 2. etasje.",
        },
      });
      expect(locRes.ok()).toBe(true);

      // 6) BILLING CONFIGURED — via the admin UI page.
      await page.goto("/admin/fakturering", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => null);
      const saveBtn = page.getByRole("button", { name: /lagre fakturaprofil/i });
      await saveBtn.waitFor({ state: "visible", timeout: 30_000 });
      await page.locator('input[name="billing_email"]').fill(`faktura-${runId}@test.lunchportalen.no`);
      await page.locator('input[name="cost_center"]').fill("KST-100");
      await page.locator('input[name="invoice_reference"]').fill("PO-2026-42");
      await saveBtn.click();
      await expect(page.getByText("Fakturaprofilen er lagret.")).toBeVisible({ timeout: 30_000 });

      // 7) COMPANY ACTIVE — final state assertions (plan materialized too).
      const { data: finalComp } = await admin
        .from("companies")
        .select("status, billing_email, cost_center, invoice_reference")
        .eq("id", companyId)
        .maybeSingle();
      expect(String(finalComp?.status)).toBe("ACTIVE");
      expect(String(finalComp?.billing_email)).toBe(`faktura-${runId}@test.lunchportalen.no`);
      expect(String(finalComp?.cost_center)).toBe("KST-100");

      const { data: finalAgr } = await admin
        .from("agreements")
        .select("status, tier, delivery_days, slot_start, slot_end")
        .eq("id", agreementId)
        .maybeSingle();
      expect(String(finalAgr?.status)).toBe("ACTIVE");
      expect(String(finalAgr?.tier)).toBe("LUXUS"); // tue = Luxus dominates Basis
      expect(finalAgr?.delivery_days).toEqual(["mon", "tue", "wed", "thu", "fri"]);

      const { data: dayTiers } = await admin
        .from("agreement_delivery_days")
        .select("weekday, tier")
        .eq("agreement_id", agreementId);
      const tiers = Object.fromEntries((dayTiers ?? []).map((r: any) => [r.weekday, r.tier]));
      expect(tiers.tue).toBe("LUXUS");
      expect(tiers.mon).toBe("BASIS");

      const { data: loc } = await admin
        .from("company_locations")
        .select("delivery_instructions, contact_name")
        .eq("id", locationId)
        .maybeSingle();
      expect(String(loc?.delivery_instructions)).toContain("varemottak");
    } finally {
      // Cleanup (reverse dependency order, triggers tolerated best-effort).
      if (userId) {
        await admin.from("company_memberships").delete().eq("user_id", userId);
        await admin.from("profiles").delete().eq("id", userId);
        try {
          await admin.auth.admin.deleteUser(userId);
        } catch {
          /* ignore */
        }
      }
      if (companyId) {
        await admin.from("company_invites").delete().eq("company_id", companyId);
        const { data: agrs } = await admin.from("agreements").select("id").eq("company_id", companyId);
        for (const a of agrs ?? []) {
          await admin.from("agreement_delivery_days").delete().eq("agreement_id", String((a as any).id));
        }
        await admin.from("company_registrations").delete().eq("company_id", companyId);
        await admin.from("agreements").delete().eq("company_id", companyId);
        await admin.from("companies").update({ default_location_id: null }).eq("id", companyId);
        await admin.from("company_locations").delete().eq("company_id", companyId);
        await admin.from("companies").delete().eq("id", companyId);
      }
      if (areaId) await admin.from("provider_service_areas").delete().eq("id", areaId);
      if (providerId) await admin.from("providers").delete().eq("id", providerId);
    }
  });
});

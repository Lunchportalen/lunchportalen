// e2e/provider-registration.e2e.ts
// PHASE 4 — browser E2E: provider self-service flow
//   registration (/bli-leverandor) → PENDING application → approval (canonical
//   RPC bootstrap, same path as the superadmin API) → invitation token →
//   acceptance (/registrer-leverandor) → first login via the ONE post-login
//   resolver → provider dashboard (/leverandor) with seeded mandatory settings.
// Skips unless staging service env is present.
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

const STAGING_REF = "uigxsboqeruxflgzqztl";
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const RUN = url.includes(STAGING_REF) && Boolean(serviceKey);

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

test.describe("provider self-service: registration → approval → invitation → acceptance → dashboard", () => {
  test.skip(!RUN, "staging NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");

  test("full flow ends on provider dashboard with seeded settings", async ({ page }) => {
    test.setTimeout(180_000);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const runId = crypto.randomUUID().slice(0, 8);
    const companyName = `E2E Catering ${runId}`;
    const email = `e2e-provider-${runId}@test.lunchportalen.no`;
    const orgNumber = `9${Math.floor(Math.random() * 90000000 + 10000000)}`;

    let registrationId: string | null = null;
    let providerId: string | null = null;
    let userId: string | null = null;

    try {
      // 1) REGISTRATION — public form in the browser.
      await page.goto("/bli-leverandor", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => null);
      const submit = page.getByRole("button", { name: /send søknad|sender/i });
      await submit.waitFor({ state: "visible", timeout: 20_000 });
      await page.waitForTimeout(1000);

      await page.locator('input[name="company_name"]').fill(companyName);
      await page.locator('input[name="org_number"]').fill(orgNumber);
      await page.locator('input[name="contact_name"]').fill("E2E Kokk");
      await page.locator('input[name="contact_email"]').fill(email);
      await submit.click();
      await expect(page.getByText("Søknad mottatt")).toBeVisible({ timeout: 30_000 });

      // 2) PENDING application exists (state machine).
      const { data: reg } = await admin
        .from("provider_registrations")
        .select("id, status, country_code, currency")
        .eq("contact_email", email)
        .maybeSingle();
      expect(String(reg?.status)).toBe("PENDING");
      registrationId = String(reg?.id);

      // 3) APPROVAL — canonical atomic bootstrap RPC (the exact path the
      //    superadmin approve endpoint calls after its role gate).
      const rawToken = crypto.randomBytes(24).toString("hex");
      const approve = await admin.rpc("lp_provider_registration_approve", {
        p_registration_id: registrationId,
        p_slug: `e2e-catering-${runId}`,
        p_token_hash: sha256(rawToken),
        p_invite_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
        p_actor_user_id: null,
      });
      expect(approve.error, approve.error?.message).toBeNull();
      providerId = String((approve.data as { provider_id?: string }).provider_id);

      // 4+5) INVITATION → ACCEPTANCE in the browser.
      await page.goto(`/registrer-leverandor?token=${rawToken}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => null);
      const activate = page.getByRole("button", { name: /aktiver konto|aktiverer/i });
      await activate.waitFor({ state: "visible", timeout: 20_000 });
      await expect(activate).toBeEnabled({ timeout: 20_000 });
      await page.waitForTimeout(1000);

      const password = `E2e-${crypto.randomBytes(12).toString("base64url")}`;
      await page.locator('input[name="password"]').fill(password);
      await page.locator('input[name="password2"]').fill(password);
      await activate.click();

      // 6) DASHBOARD — post-login resolver lands provider_admin on /leverandor.
      await page.waitForURL((u) => u.pathname.startsWith("/leverandor"), { timeout: 60_000 });
      expect(new URL(page.url()).pathname.startsWith("/leverandor")).toBe(true);

      // Tenant binding + mandatory setup seeded from the application.
      const { data: prof } = await admin.from("profiles").select("id, role, company_id").eq("email", email).maybeSingle();
      expect(String(prof?.role)).toBe("provider_admin");
      expect(prof?.company_id).toBeNull();
      userId = prof?.id ? String(prof.id) : null;

      const { data: mem } = await admin
        .from("provider_memberships")
        .select("role")
        .eq("user_id", userId!)
        .eq("provider_id", providerId)
        .maybeSingle();
      expect(String(mem?.role)).toBe("provider_admin");

      const { data: settings } = await admin
        .from("provider_settings")
        .select("default_country_code, default_currency, locale, invoice_language, cutoff_time")
        .eq("provider_id", providerId)
        .maybeSingle();
      expect(String(settings?.default_country_code)).toBe("NO");
      expect(String(settings?.default_currency)).toBe("NOK");
      expect(String(settings?.invoice_language)).toBe("nb");
      expect(String(settings?.cutoff_time)).toBe("08:00");

      // Invite consumed (single-use).
      const { data: inv } = await admin
        .from("provider_invites")
        .select("used_at")
        .eq("provider_id", providerId)
        .maybeSingle();
      expect(inv?.used_at).toBeTruthy();
    } finally {
      // Cleanup: memberships, profile+user, invite, settings, org, provider, registration.
      if (userId) {
        await admin.from("provider_memberships").delete().eq("user_id", userId);
        try {
          await admin.auth.admin.deleteUser(userId);
        } catch {
          /* ignore */
        }
      }
      if (providerId) {
        await admin.from("provider_invites").delete().eq("provider_id", providerId);
        await admin.from("provider_settings").delete().eq("provider_id", providerId);
        await admin.from("organizations").delete().eq("id", providerId);
        if (registrationId) {
          await admin.from("provider_registrations").delete().eq("id", registrationId);
        }
        await admin.from("providers").delete().eq("id", providerId);
      } else if (registrationId) {
        await admin.from("provider_registrations").delete().eq("id", registrationId);
      }
    }
  });
});

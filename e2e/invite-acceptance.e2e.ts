// e2e/invite-acceptance.e2e.ts
// PHASE 3 — browser E2E: employee invite → acceptance → first login lands via
// the ONE canonical post-login resolver (never a hardcoded client destination).
//
// Seeds a real employee invite on staging (service role), drives the canonical
// /register/employee page, and asserts the browser leaves the register page and
// lands on a resolver-produced route (/week or /avtale-ikke-aktiv), i.e. it went
// through /api/auth/post-login. Skips unless staging service env is present.
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

const STAGING_REF = "uigxsboqeruxflgzqztl";
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const A6_COMPANY_ID = "8b0b8fa4-8d89-4795-b92b-e09129dd635f";
const A6_LOCATION_ID = "f319b299-8914-4c52-9984-569ce07c914d";

const RUN = url.includes(STAGING_REF) && Boolean(serviceKey);

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

test.describe("invite → acceptance → first login (canonical resolver)", () => {
  test.skip(!RUN, "staging NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");

  test("employee invite acceptance routes through post-login, never a hardcoded home", async ({ page }) => {
    test.setTimeout(120_000);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const rawToken = crypto.randomBytes(24).toString("hex");
    const email = `e2e-invite-${crypto.randomUUID().slice(0, 8)}@test.lunchportalen.no`;
    const inviteId = crypto.randomUUID();

    // Seed a fresh employee invite for the A6 fixture company/location.
    const { error: insErr } = await admin.from("employee_invites").insert({
      id: inviteId,
      company_id: A6_COMPANY_ID,
      location_id: A6_LOCATION_ID,
      email,
      role: "employee",
      token_hash: sha256(rawToken),
      expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    });
    expect(insErr, insErr?.message).toBeNull();

    let createdUserId: string | null = null;
    try {
      await page.goto(`/register/employee?token=${rawToken}`, { waitUntil: "domcontentloaded" });
      // Wait for client hydration so the React onSubmit (preventDefault + fetch)
      // is attached — otherwise a fast click triggers a native GET form submit.
      await page.waitForLoadState("networkidle").catch(() => null);
      const submit = page.getByRole("button", { name: /aktiver konto|aktiverer|fullf/i });
      await submit.waitFor({ state: "visible", timeout: 20_000 });
      await expect(submit).toBeEnabled({ timeout: 20_000 });
      await page.waitForTimeout(1000);

      const pw = page.locator('input[name="password"]');
      const pw2 = page.locator('input[name="password2"]');
      const password = `E2e-${crypto.randomBytes(12).toString("base64url")}`;
      await pw.fill(password);
      await pw2.fill(password);

      await submit.click();
      await page.waitForURL((u) => !u.pathname.startsWith("/register/employee"), { timeout: 45_000 });

      // Landed via the resolver: not on the register page, not on a raw error.
      const landed = new URL(page.url());
      expect(landed.pathname.startsWith("/register/employee")).toBe(false);
      expect(landed.pathname).toMatch(/^\/(week|avtale-ikke-aktiv|status)/);

      // Invite consumed atomically.
      const { data: inv } = await admin.from("employee_invites").select("used_at").eq("id", inviteId).maybeSingle();
      expect(inv?.used_at).toBeTruthy();

      const { data: prof } = await admin.from("profiles").select("id, company_id, role").eq("email", email).maybeSingle();
      expect(String(prof?.company_id)).toBe(A6_COMPANY_ID);
      expect(String(prof?.role)).toBe("employee");
      createdUserId = prof?.id ? String(prof.id) : null;
    } finally {
      // Cleanup: invite + profile + auth user.
      await admin.from("employee_invites").delete().eq("id", inviteId);
      if (createdUserId) {
        try {
          await admin.auth.admin.deleteUser(createdUserId);
        } catch {
          /* ignore */
        }
      }
    }
  });
});

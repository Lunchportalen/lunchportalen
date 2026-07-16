// e2e/employee-weekly-ordering.e2e.ts
// PHASE 6 — browser E2E (employee role):
//   invite → accept (canonical flow) → login via post-login resolver →
//   week menu → daily order → full-week order (canonical bulk) → update →
//   cancel before cutoff → history — with production/commission/notification
//   assertions and 0 wrong-provider orders.
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

/** Neste hele uke (man/tir/ons) minst 2 dager frem — aldri cutoff-følsomt. */
function nextWeekMonTueWed(): [string, string, string] {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const mon = new Date(d);
  const tue = new Date(d);
  tue.setUTCDate(tue.getUTCDate() + 1);
  const wed = new Date(d);
  wed.setUTCDate(wed.getUTCDate() + 2);
  return [iso(mon), iso(tue), iso(wed)];
}

test.describe("employee weekly ordering: invite → accept → order → bulk → update → cancel → history", () => {
  test.skip(!RUN, "staging NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");

  test("full employee flow with corrected production/commission basis", async ({ page }) => {
    test.setTimeout(300_000);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const runId = crypto.randomUUID().slice(0, 8);
    const providerId = crypto.randomUUID();
    const companyId = crypto.randomUUID();
    const locationId = crypto.randomUUID();
    const inviteId = crypto.randomUUID();
    const email = `e2e-week-${runId}@test.lunchportalen.no`;
    const rawToken = crypto.randomBytes(24).toString("hex");
    const [monday, tuesday, wednesday] = nextWeekMonTueWed();
    let userId: string | null = null;

    try {
      // ---- Seed: provider + org mirror + company + location + ACTIVE agreement ----
      await admin.from("providers").insert({
        id: providerId,
        name: `E2E Week Prov ${runId}`,
        slug: `e2e-week-prov-${runId}`,
        contact_email: `week-prov-${runId}@test.lunchportalen.no`,
        billing_model: "SAAS_FIXED",
        status: "ACTIVE",
      });
      await admin.from("organizations").insert({
        id: providerId,
        type: "provider",
        name: `E2E Week Prov ${runId}`,
        slug: `e2e-week-prov-${runId}`,
        status: "ACTIVE",
        legacy_source: "provider",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await admin.from("companies").insert({
        id: companyId,
        name: `E2E Week Co ${runId}`,
        status: "ACTIVE",
        orgnr: `9${Math.floor(Math.random() * 90000000 + 10000000)}`,
        provider_id: providerId,
        employee_count: 25,
      });
      await admin.from("company_locations").insert({ id: locationId, company_id: companyId, name: "Hovedlokasjon", address: "Testveien 1" });
      await admin.from("companies").update({ default_location_id: locationId }).eq("id", companyId);
      const agrIns = await admin.from("agreements").insert({
        company_id: companyId,
        location_id: locationId,
        provider_id: providerId,
        tier: "BASIS",
        status: "ACTIVE",
        delivery_days: ["mon", "tue", "wed", "thu", "fri"],
        slot_start: "11:00",
        slot_end: "13:00",
        starts_at: new Date().toISOString(),
      });
      expect(agrIns.error, agrIns.error?.message).toBeNull();

      // Published menu for mon/tue/wed at BASIS price with global catalog products.
      for (const date of [monday, tuesday, wednesday]) {
        const { data: msd, error: msdErr } = await admin
          .from("menu_service_days")
          .upsert(
            {
              company_id: companyId,
              location_id: locationId,
              service_date: date,
              state: "published",
              provider_id: providerId,
              cutoff_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
              published_at: new Date().toISOString(),
            },
            { onConflict: "location_id,service_date" },
          )
          .select("id")
          .maybeSingle();
        expect(msdErr, msdErr?.message).toBeNull();
        const msdId = String((msd as { id?: string } | null)?.id ?? "");
        const { data: products } = await admin
          .from("products")
          .select("id, name, sku")
          .is("company_id", null)
          .in("sku", ["paasmurt", "salatboks", "varmrett"]);
        for (const [i, p] of (products ?? []).entries()) {
          await admin.from("menu_service_day_items").insert({
            menu_service_day_id: msdId,
            product_id: (p as { id: string }).id,
            product_name_snapshot: (p as { name: string }).name,
            unit_name_snapshot: "porsjon",
            offered_price_cents_ex_vat: 9000,
            vat_rate_snapshot: 0.15,
            quantity: 1,
            sort_order: 10 + i,
            is_optional: false,
          });
        }
      }

      // ---- 1) INVITE (canonical employee invite) ----
      const invIns = await admin.from("employee_invites").insert({
        id: inviteId,
        company_id: companyId,
        location_id: locationId,
        email,
        role: "employee",
        token_hash: sha256(rawToken),
        expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
      });
      expect(invIns.error, invIns.error?.message).toBeNull();

      // ---- 2) ACCEPT + 3) LOGIN via post-login resolver ----
      await page.goto(`/register/employee?token=${rawToken}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => null);
      const submit = page.getByRole("button", { name: /aktiver konto|aktiverer|fullf/i });
      await submit.waitFor({ state: "visible", timeout: 30_000 });
      await expect(submit).toBeEnabled({ timeout: 20_000 });
      await page.waitForTimeout(1000);
      const password = `E2e-${crypto.randomBytes(12).toString("base64url")}`;
      await page.locator('input[name="password"]').fill(password);
      await page.locator('input[name="password2"]').fill(password);
      await submit.click();
      await page.waitForURL((u) => u.pathname.startsWith("/week"), { timeout: 60_000 });

      const { data: prof } = await admin.from("profiles").select("id, role, company_id, location_id").eq("email", email).maybeSingle();
      expect(String(prof?.role)).toBe("employee");
      expect(String(prof?.company_id)).toBe(companyId);
      expect(String(prof?.location_id)).toBe(locationId);
      userId = prof?.id ? String(prof.id) : null;

      // ---- 4) WEEK MENU renders with the seeded days ----
      await page.waitForLoadState("networkidle").catch(() => null);
      const mondayPill = page.locator(`[data-lp-date="${monday}"]`);
      await mondayPill.waitFor({ state: "visible", timeout: 30_000 });

      // ---- 5) DAILY ORDER (Monday, via UI) ----
      await mondayPill.click();
      await page.waitForTimeout(800);
      const category = page.locator(".week-category-card:not(.is-unavailable)").first();
      await category.waitFor({ state: "visible", timeout: 20_000 });
      await category.click();
      // Categories with multiple menu variants require an explicit item pick.
      const variantBtn = page.locator(".ds-week-item-btn").first();
      if (await variantBtn.isVisible().catch(() => false)) {
        await variantBtn.click();
      }
      const orderBtn = page.getByRole("button", { name: "Bestill lunsj" }).first();
      await expect(orderBtn).toBeEnabled({ timeout: 20_000 });
      await orderBtn.click();
      await page.getByRole("button", { name: "Bekreft" }).click();
      await expect(page.getByText("Bestilling registrert ✔")).toBeVisible({ timeout: 45_000 });

      // ---- 6) FULL-WEEK ORDER (Tue+Wed via canonical bulk) ----
      const bulkCard = page.locator("[data-lp-week-bulk]");
      await bulkCard.waitFor({ state: "visible", timeout: 30_000 });
      const bulkSelect = bulkCard.locator('select[name="bulk_choice"]');
      if (await bulkSelect.isVisible().catch(() => false)) {
        await bulkSelect.selectOption({ index: 1 });
      }
      await bulkCard.locator('button[name="order-whole-week"]').click();
      await expect(page.getByText("Ukesbestilling registrert ✔")).toBeVisible({ timeout: 60_000 });

      // All three days now ACTIVE with the right provider (0 wrong-provider).
      const { data: activeOrders } = await admin
        .from("orders")
        .select("id, date, status, provider_id")
        .eq("company_id", companyId)
        .eq("status", "ACTIVE");
      expect((activeOrders ?? []).length).toBe(3);
      expect((activeOrders ?? []).every((o: any) => String(o.provider_id) === providerId)).toBe(true);

      // ---- 7) UPDATE existing order (Monday → new choice, canonical engine, same session) ----
      const updRes = await page.request.post("/api/orders", {
        headers: { "Idempotency-Key": crypto.randomUUID() },
        data: { date: monday, action: "set", choice_key: "varmmat" },
      });
      expect(updRes.ok()).toBe(true);
      const { data: mondayChoice } = await admin
        .from("day_choices")
        .select("choice_key")
        .eq("user_id", userId!)
        .eq("date", monday)
        .maybeSingle();
      expect(String((mondayChoice as { choice_key?: string } | null)?.choice_key ?? "")).toMatch(/varm/);
      const { data: mondayActive } = await admin
        .from("orders")
        .select("id")
        .eq("user_id", userId!)
        .eq("date", monday)
        .eq("status", "ACTIVE");
      expect((mondayActive ?? []).length).toBe(1); // update, not duplicate

      // ---- 8) CANCEL before cutoff (Tuesday, via UI) ----
      await page.locator(`[data-lp-date="${tuesday}"]`).click();
      await page.waitForTimeout(800);
      const cancelBtn = page.getByRole("button", { name: "Avbestill lunsj" }).first();
      await cancelBtn.waitFor({ state: "visible", timeout: 20_000 });
      await cancelBtn.click();
      await page.getByRole("button", { name: "Bekreft" }).click();
      await expect(page.getByText("Avbestilling registrert ✔")).toBeVisible({ timeout: 45_000 });

      // Production basis corrected: Tuesday has 0 ACTIVE, 1 CANCELLED history row.
      const { data: tueOrders } = await admin
        .from("orders")
        .select("id, status")
        .eq("user_id", userId!)
        .eq("date", tuesday);
      const tueActive = (tueOrders ?? []).filter((o: any) => o.status === "ACTIVE");
      const tueCancelled = (tueOrders ?? []).filter((o: any) => o.status === "CANCELLED");
      expect(tueActive.length).toBe(0);
      expect(tueCancelled.length).toBe(1);
      const cancelledOrderId = String((tueCancelled[0] as { id: string }).id);

      // Commission-basis correction hook ran (LEDGER_SKIPPED diagnostic —
      // pre-delivery cancel has nothing to reverse; hook is idempotent).
      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from("billing_readiness_events")
              .select("id")
              .eq("order_id", cancelledOrderId)
              .eq("event_type", "LEDGER_SKIPPED");
            return (data ?? []).length;
          },
          { timeout: 30_000 },
        )
        .toBeGreaterThanOrEqual(1);

      // Provider notification + employee confirmation queued via outbox.
      const { data: notifyRows } = await admin
        .from("outbox")
        .select("event_key")
        .eq("event_key", `order.cancel.notify:${cancelledOrderId}`);
      expect((notifyRows ?? []).length).toBe(1);
      const { data: emailRows } = await admin
        .from("outbox")
        .select("event_key")
        .like("event_key", `order.email:${userId}:%`);
      expect((emailRows ?? []).length).toBeGreaterThanOrEqual(2); // confirmed + cancelled

      // ---- 9) HISTORY (locale-correct dates, both statuses) ----
      await page.goto("/week/mine-lunsjendringer", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => null);
      await expect(page.getByText(/avbestilt/i).first()).toBeVisible({ timeout: 30_000 });
    } finally {
      // ---- Cleanup ----
      if (userId) {
        const { data: orderIds } = await admin.from("orders").select("id").eq("company_id", companyId);
        for (const o of orderIds ?? []) {
          const oid = String((o as { id: string }).id);
          await admin.from("order_status_history").delete().eq("order_id", oid);
          await admin.from("order_items").delete().eq("order_id", oid);
          await admin.from("billing_readiness_events").delete().eq("order_id", oid);
          await admin.from("outbox").delete().eq("event_key", `order.cancel.notify:${oid}`);
        }
        await admin.from("outbox").delete().like("event_key", `order.email:${userId}:%`);
        await admin.from("outbox").delete().like("event_key", `order.set:${userId}:%`);
        await admin.from("orders").delete().eq("company_id", companyId);
        await admin.from("day_choices").delete().eq("company_id", companyId);
        await admin.from("company_memberships").delete().eq("user_id", userId);
        await admin.from("profiles").delete().eq("id", userId);
        try {
          await admin.auth.admin.deleteUser(userId);
        } catch {
          /* ignore */
        }
      }
      await admin.from("employee_invites").delete().eq("id", inviteId);
      const { data: msds } = await admin.from("menu_service_days").select("id").eq("location_id", locationId);
      for (const m of msds ?? []) {
        await admin.from("menu_service_day_items").delete().eq("menu_service_day_id", String((m as { id: string }).id));
      }
      await admin.from("menu_service_days").delete().eq("location_id", locationId);
      const { data: agrs } = await admin.from("agreements").select("id").eq("company_id", companyId);
      for (const a of agrs ?? []) {
        await admin.from("agreement_delivery_days").delete().eq("agreement_id", String((a as { id: string }).id));
      }
      await admin.from("agreements").delete().eq("company_id", companyId);
      await admin.from("companies").update({ default_location_id: null }).eq("id", companyId);
      await admin.from("company_locations").delete().eq("company_id", companyId);
      await admin.from("companies").delete().eq("id", companyId);
      await admin.from("organizations").delete().eq("id", providerId);
      await admin.from("providers").delete().eq("id", providerId);
    }
  });
});

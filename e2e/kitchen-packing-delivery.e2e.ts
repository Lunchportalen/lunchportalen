// e2e/kitchen-packing-delivery.e2e.ts
// PHASE 7 — browser E2E (physical operations):
//   employee order → provider kitchen (/leverandor/ordrer) → production
//   (Start produksjon) → packed/out-for-delivery (Klar for levering + batch
//   PACKED) → driver (actor + /driver) → delivered — with packing list,
//   exact counts, 0 cancelled portions, 0 foreign provider rows and
//   provider-owned notification routing.
// Skips unless staging service env + SUPABASE_POSTGRES_URL are present.
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { Client as PgClient } from "pg";

const STAGING_REF = "uigxsboqeruxflgzqztl";
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const pgUrl = process.env.SUPABASE_POSTGRES_URL ?? "";
const RUN = url.includes(STAGING_REF) && Boolean(serviceKey) && Boolean(pgUrl);

async function pgQuery(text: string, values: unknown[] = []) {
  const client = new PgClient({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    return await client.query(text, values);
  } finally {
    await client.end();
  }
}

/** Trigger-safe seed (replica mode) so the spec is deterministic at any hour. */
async function pgReplica(statements: Array<{ text: string; values?: unknown[] }>) {
  const client = new PgClient({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("set local session_replication_role = replica");
    for (const s of statements) await client.query(s.text, s.values ?? []);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => null);
    throw e;
  } finally {
    await client.end();
  }
}

function todayOsloISO(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(new Date());
}

test.describe("kitchen → packing → delivery (physical operations)", () => {
  test.skip(!RUN, "staging env + SUPABASE_POSTGRES_URL required");

  test("full physical flow with exact counts and tenant isolation", async ({ page }) => {
    test.setTimeout(300_000);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const runId = crypto.randomUUID().slice(0, 8);
    const provA = crypto.randomUUID();
    const provB = crypto.randomUUID();
    const compA = crypto.randomUUID();
    const compB = crypto.randomUUID();
    const locA = crypto.randomUUID();
    const locB = crypto.randomUUID();
    const date = todayOsloISO();
    const password = `E2e-${crypto.randomBytes(12).toString("base64url")}`;
    const kitchenEmail = `e2e-kpd-kitchen-${runId}@test.lunchportalen.no`;
    const driverEmail = `e2e-kpd-driver-${runId}@test.lunchportalen.no`;
    const users: string[] = [];

    async function createUser(email: string) {
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      const id = String(created.data.user.id);
      users.push(id);
      for (let i = 0; i < 25; i += 1) {
        const { data: p } = await admin.from("profiles").select("id").eq("id", id).maybeSingle();
        if (p?.id) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      return id;
    }

    const orderA1 = crypto.randomUUID();
    const orderA2 = crypto.randomUUID();
    const orderB = crypto.randomUUID();

    try {
      // ---- Seed tenants (A under test with delivery info + provider-owned emails; B isolation) ----
      for (const [pid, cid, lid, label] of [
        [provA, compA, locA, "a"],
        [provB, compB, locB, "b"],
      ] as const) {
        await pgQuery(
          `insert into public.providers (id, name, slug, contact_email, billing_model, status)
           values ($1, $2, $3, $4, 'SAAS_FIXED', 'ACTIVE')`,
          [pid, `KPD Prov ${label} ${runId}`, `kpd-prov-${label}-${runId}`, `kpd-prov-${label}-${runId}@test.lunchportalen.no`],
        );
        await pgQuery(
          `insert into public.organizations (id, type, name, slug, status, legacy_source, created_at, updated_at)
           values ($1, 'provider', $2, $3, 'ACTIVE', 'provider', now(), now()) on conflict (id) do nothing`,
          [pid, `KPD Prov ${label} ${runId}`, `kpd-prov-${label}-${runId}`],
        );
        await pgQuery(
          `insert into public.companies (id, name, status, orgnr, provider_id, employee_count)
           values ($1, $2, 'ACTIVE', $3, $4::uuid, 25)`,
          [cid, `KPD Co ${label} ${runId}`, `9${Math.floor(Math.random() * 90000000 + 10000000)}`, pid],
        );
        await pgQuery(
          `insert into public.company_locations (id, company_id, name, address, delivery_instructions, window_from, window_to)
           values ($1, $2, 'Hovedlokasjon', 'Opsveien 1', 'Ring på ved varemottak, 2. etasje', '11:00', '13:00')`,
          [lid, cid],
        );
        await pgQuery(`update public.companies set default_location_id = $2 where id = $1`, [cid, lid]);
      }
      const agrA = await pgQuery(
        `insert into public.agreements (company_id, location_id, provider_id, tier, status, delivery_days, slot_start, slot_end, starts_at)
         values ($1, $2, $3::uuid, 'BASIS', 'ACTIVE', '["mon","tue","wed","thu","fri"]'::jsonb, '11:00', '13:00', now()) returning id`,
        [compA, locA, provA],
      );
      const agrB = await pgQuery(
        `insert into public.agreements (company_id, location_id, provider_id, tier, status, delivery_days, slot_start, slot_end, starts_at)
         values ($1, $2, $3::uuid, 'BASIS', 'ACTIVE', '["mon","tue","wed","thu","fri"]'::jsonb, '11:00', '13:00', now()) returning id`,
        [compB, locB, provB],
      );
      const agreementA = String(agrA.rows[0].id);
      const agreementB = String(agrB.rows[0].id);
      // Provider-eide varslingsmottakere for A (kravet: routing til provider-owned).
      await pgQuery(
        `insert into public.provider_settings (provider_id, default_currency, default_country_code, timezone, cutoff_time, locale, operations_email, delivery_email)
         values ($1, 'NOK', 'NO', 'Europe/Oslo', '08:00', 'nb-NO', $2, $3)
         on conflict (provider_id) do update set operations_email = excluded.operations_email, delivery_email = excluded.delivery_email`,
        [provA, `ops-${runId}@catering-a.test`, `levering-${runId}@catering-a.test`],
      );

      // ---- Users ----
      const empA1 = await createUser(`e2e-kpd-emp1-${runId}@test.lunchportalen.no`);
      const empA2 = await createUser(`e2e-kpd-emp2-${runId}@test.lunchportalen.no`);
      const empB = await createUser(`e2e-kpd-empb-${runId}@test.lunchportalen.no`);
      const kitchenA = await createUser(kitchenEmail);
      const driverA = await createUser(driverEmail);

      await pgQuery(`update public.profiles set role='employee', company_id=$2, location_id=$3, full_name='Emma Ansatt', active=true where id=$1`, [empA1, compA, locA]);
      await pgQuery(`update public.profiles set role='employee', company_id=$2, location_id=$3, full_name='Kalle Kansellert', active=true where id=$1`, [empA2, compA, locA]);
      await pgQuery(`update public.profiles set role='employee', company_id=$2, location_id=$3, active=true where id=$1`, [empB, compB, locB]);
      await pgQuery(`update public.profiles set role='provider_admin', company_id=null, location_id=null, active=true where id=$1`, [kitchenA]);
      await pgQuery(`insert into public.provider_memberships (user_id, provider_id, role) values ($1, $2, 'provider_kitchen')`, [kitchenA, provA]);
      await pgQuery(`update public.profiles set role='driver', company_id=$2, location_id=$3, active=true where id=$1`, [driverA, compA, locA]);
      await pgQuery(`insert into public.provider_memberships (user_id, provider_id, role) values ($1, $2, 'provider_viewer')`, [driverA, provA]);
      await pgQuery(
        `insert into public.lp_user_allergens (user_id, codes, free_text)
         values ($1, array['gluten']::public.lp_allergen_code[], 'Ingen nøtter')
         on conflict (user_id) do update set codes = excluded.codes, free_text = excluded.free_text`,
        [empA1],
      );

      // ---- 1) EMPLOYEE ORDERS for TODAY (trigger-safe seed: deterministic at any hour) ----
      await pgReplica([
        {
          text: `insert into public.orders (id, user_id, date, status, company_id, location_id, provider_id, agreement_id, tier, unit_price_nok, slot, note)
                 values ($1, $2, $3::date, 'ACTIVE', $4, $5, $6::uuid, $7::uuid, 'BASIS', 90, 'default', 'Ekstra dressing')`,
          values: [orderA1, empA1, date, compA, locA, provA, agreementA],
        },
        {
          text: `insert into public.order_items (order_id, product_id, quantity, product_name_snapshot, unit_name_snapshot, allergens_snapshot, unit_price_cents_ex_vat, vat_rate_snapshot, line_subtotal_cents_ex_vat, line_vat_cents, line_total_cents_inc_vat)
                 select $1, p.id, 1, 'Påsmurt m/ost', 'porsjon', '["gluten","melk"]'::jsonb, 9000, 0.15, 9000, 1350, 10350
                 from public.products p where p.company_id is null and p.sku = 'paasmurt' limit 1`,
          values: [orderA1],
        },
        {
          text: `insert into public.orders (id, user_id, date, status, company_id, location_id, provider_id, agreement_id, tier, unit_price_nok, slot, cancelled_at)
                 values ($1, $2, $3::date, 'CANCELLED', $4, $5, $6::uuid, $7::uuid, 'BASIS', 90, 'default', now())`,
          values: [orderA2, empA2, date, compA, locA, provA, agreementA],
        },
        {
          text: `insert into public.orders (id, user_id, date, status, company_id, location_id, provider_id, agreement_id, tier, unit_price_nok, slot)
                 values ($1, $2, $3::date, 'ACTIVE', $4, $5, $6::uuid, $7::uuid, 'BASIS', 90, 'default')`,
          values: [orderB, empB, date, compB, locB, provB, agreementB],
        },
      ]);

      // ---- 2) PROVIDER KITCHEN (browser login as provider_kitchen) ----
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => null);
      await page.waitForTimeout(800);
      await page.locator('input[autocomplete="email"], input[type="email"]').first().fill(kitchenEmail);
      await page.locator('input[type="password"]').first().fill(password);
      await page.getByRole("button", { name: /logg inn/i }).click();
      await page.waitForURL((u) => u.pathname.startsWith("/leverandor"), { timeout: 60_000 });

      await page.goto("/leverandor/ordrer?date=today", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => null);
      await expect(page.getByText("Emma Ansatt").first()).toBeVisible({ timeout: 30_000 });
      // Foreign provider rows: provider B's order never appears (0 foreign rows).
      await expect(page.getByText(`KPD Co b ${runId}`)).toHaveCount(0);

      // ---- 3) PRODUCTION: Mottatt → I produksjon ----
      await page.getByRole("button", { name: "Start produksjon" }).first().click();
      await expect(page.getByText("I produksjon").first()).toBeVisible({ timeout: 30_000 });

      // ---- 4) PACKED / OUT-FOR-DELIVERY: → Klar for levering ----
      await page.getByRole("button", { name: "Klar for levering" }).first().click();
      await expect(page.getByRole("button", { name: "Marker levert" }).first()).toBeVisible({ timeout: 30_000 });

      // Packing list: exact production counts, 0 cancelled portions, delivery
      // info + allergens, and 0 foreign provider rows.
      await page.goto(`/leverandor/pakkeliste?date=${date}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("1 porsjoner · 1 leveringssteder", { exact: false })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Ring på ved varemottak", { exact: false }).first()).toBeVisible();
      await expect(page.getByText("Ingen nøtter", { exact: false }).first()).toBeVisible();
      await expect(page.getByText("Kalle Kansellert")).toHaveCount(0); // cancelled excluded
      await expect(page.getByText(`KPD Co b ${runId}`)).toHaveCount(0); // foreign excluded

      // CSV export (offline/print) via same session.
      const csvRes = await page.request.get(`/api/provider/packing-list?date=${date}&format=csv`);
      expect(csvRes.ok()).toBe(true);
      const csv = await csvRes.text();
      expect(csv).toContain("Påsmurt m/ost");
      expect(csv).not.toContain(`KPD Co b ${runId}`);

      // ---- 5) BATCH (unified model) + DRIVER assignment + delivered ----
      await pgQuery(
        `insert into public.kitchen_batches (delivery_date, delivery_window, company_location_id, status, driver_user_id, driver_assigned_at, driver_assigned_by)
         values ($1::date, 'default', $2::uuid, 'QUEUED', $3::uuid, now(), $4::uuid)
         on conflict (delivery_date, delivery_window, company_location_id) do update set driver_user_id = excluded.driver_user_id`,
        [date, locA, driverA, kitchenA],
      );
      const packed = await admin.rpc("lp_batch_transition_and_sync_orders", {
        p_delivery_date: date,
        p_delivery_window: "default",
        p_company_location_id: locA,
        p_target_batch_status: "PACKED",
        p_actor_user_id: kitchenA,
        p_mode: "from_queued",
      });
      expect(packed.error, packed.error?.message).toBeNull();

      // Driver in the browser: role landing + stops contract for today.
      await page.context().clearCookies();
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => null);
      await page.waitForTimeout(800);
      await page.locator('input[autocomplete="email"], input[type="email"]').first().fill(driverEmail);
      await page.locator('input[type="password"]').first().fill(password);
      await page.getByRole("button", { name: /logg inn/i }).click();
      // Post-login: provider-medlemskap vinner over profilrolle (roleHome-lov),
      // så sjåføren med provider-medlemskap lander i /leverandor. /driver-flaten
      // er fortsatt tilgjengelig for driver-profilen — verifiser begge.
      await page.waitForURL((u) => u.pathname.startsWith("/driver") || u.pathname.startsWith("/leverandor"), {
        timeout: 60_000,
      });
      await page.goto("/driver", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => null);
      expect(new URL(page.url()).pathname.startsWith("/driver")).toBe(true);
      const stopsRes = await page.request.get(`/api/driver/stops?date=${date}`);
      expect(stopsRes.ok()).toBe(true);

      // Driver marks the batch DELIVERED (same canonical RPC the driver
      // bulk-set endpoint calls; actor = assigned driver).
      const delivered = await admin.rpc("lp_batch_transition_and_sync_orders", {
        p_delivery_date: date,
        p_delivery_window: "default",
        p_company_location_id: locA,
        p_target_batch_status: "DELIVERED",
        p_actor_user_id: driverA,
        p_mode: "from_packed",
      });
      expect(delivered.error, delivered.error?.message).toBeNull();

      // ---- 6) DELIVERED end-state assertions ----
      const { rows: finalOrder } = await pgQuery(`select status::text as s from public.orders where id = $1::uuid`, [orderA1]);
      expect(finalOrder[0].s).toBe("DELIVERED");
      const { rows: foreign } = await pgQuery(
        `select count(*)::int as n from public.orders where provider_id = $1::uuid and company_id <> $2::uuid`,
        [provA, compA],
      );
      expect(foreign[0].n).toBe(0);
      const { rows: bOrder } = await pgQuery(`select status::text as s from public.orders where id = $1::uuid`, [orderB]);
      expect(bOrder[0].s).toBe("ACTIVE"); // provider B untouched

      // Audit: transitions with actor + timestamp.
      const { rows: hist } = await pgQuery(
        `select from_status::text as f, to_status::text as t, changed_by::text as actor from public.order_status_history where order_id = $1::uuid order by changed_at`,
        [orderA1],
      );
      const transitions = hist.map((h) => `${h.f}->${h.t}`);
      expect(transitions).toContain("ACTIVE->PREPARED");
      expect(transitions).toContain("PREPARED->DISPATCHED");
      expect(transitions).toContain("DISPATCHED->DELIVERED");

      // Notification routed to PROVIDER-OWNED recipient (delivery_email chain).
      const { data: dispatchedOutbox } = await admin
        .from("outbox")
        .select("payload")
        .eq("event_key", `order.status.dispatched:${orderA1}`)
        .maybeSingle();
      expect(dispatchedOutbox).toBeTruthy();
      expect(String((dispatchedOutbox as any)?.payload?.to ?? "")).toContain(`levering-${runId}@catering-a.test`);

      // Batch delivered + linked to correct company/location + assigned driver.
      const { rows: batch } = await pgQuery(
        `select status, company_location_id::text as loc, driver_user_id::text as driver from public.kitchen_batches where delivery_date = $1::date and company_location_id = $2::uuid`,
        [date, locA],
      );
      expect(batch[0].status).toBe("DELIVERED");
      expect(batch[0].loc).toBe(locA);
      expect(batch[0].driver).toBe(driverA);
    } finally {
      // ---- Cleanup ----
      await pgReplica([
        { text: `delete from public.order_status_history where order_id = any($1::uuid[])`, values: [[orderA1, orderA2, orderB]] },
        { text: `delete from public.order_items where order_id = any($1::uuid[])`, values: [[orderA1, orderA2, orderB]] },
        { text: `delete from public.billing_readiness_events where order_id = any($1::uuid[])`, values: [[orderA1, orderA2, orderB]] },
        { text: `delete from public.commission_ledger where order_id = any($1::uuid[])`, values: [[orderA1, orderA2, orderB]] },
        { text: `delete from public.outbox where event_key like 'order.status.%:' || $1 or event_key like 'order.status.%:' || $2`, values: [orderA1, orderB] },
        { text: `delete from public.orders where id = any($1::uuid[])`, values: [[orderA1, orderA2, orderB]] },
        { text: `delete from public.day_choices where company_id = any($1::uuid[])`, values: [[compA, compB]] },
        { text: `delete from public.kitchen_batches where company_location_id = any($1::uuid[])`, values: [[locA, locB]] },
        { text: `delete from public.lp_user_allergens where user_id = any($1::uuid[])`, values: [users] },
        { text: `delete from public.provider_memberships where user_id = any($1::uuid[])`, values: [users] },
        { text: `delete from public.profiles where id = any($1::uuid[])`, values: [users] },
        { text: `delete from public.provider_settings where provider_id = any($1::uuid[])`, values: [[provA, provB]] },
        { text: `delete from public.agreement_delivery_days where agreement_id in (select id from public.agreements where company_id = any($1::uuid[]))`, values: [[compA, compB]] },
        { text: `delete from public.agreements where company_id = any($1::uuid[])`, values: [[compA, compB]] },
        { text: `update public.companies set default_location_id = null where id = any($1::uuid[])`, values: [[compA, compB]] },
        { text: `delete from public.company_locations where company_id = any($1::uuid[])`, values: [[compA, compB]] },
        { text: `delete from public.companies where id = any($1::uuid[])`, values: [[compA, compB]] },
        { text: `delete from public.organizations where id = any($1::uuid[])`, values: [[provA, provB]] },
        { text: `delete from public.providers where id = any($1::uuid[])`, values: [[provA, provB]] },
      ]).catch(() => null);
      for (const id of users) {
        try {
          await admin.auth.admin.deleteUser(id);
        } catch {
          /* ignore */
        }
      }
    }
  });
});

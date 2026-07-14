// e2e/invoice-only-billing.e2e.ts
// PHASE 8 — browser E2E (invoice-only, no Stripe):
//   delivered orders → provider builds DRAFT in UI → finalize (ISSUED,
//   sequential number) → send (SENT, e-post til fakturamottaker) → manual
//   bank payment → PAID → company admin sees ONLY own invoice (read-only) →
//   provider isolation (B's invoice invisible for A).
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

async function pg(statements: Array<{ text: string; values?: unknown[] }>, replica = false) {
  const client = new PgClient({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("begin");
    if (replica) await client.query("set local session_replication_role = replica");
    const results = [];
    for (const s of statements) results.push(await client.query(s.text, s.values ?? []));
    await client.query("commit");
    return results;
  } catch (e) {
    await client.query("rollback").catch(() => null);
    throw e;
  } finally {
    await client.end();
  }
}

test.describe("invoice-only billing: draft → issue → send → paid + isolation", () => {
  test.skip(!RUN, "staging env + SUPABASE_POSTGRES_URL required");

  test("full lifecycle in provider UI, company sees only own invoice", async ({ page }) => {
    test.setTimeout(300_000);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const runId = crypto.randomUUID().slice(0, 8);
    const provA = crypto.randomUUID();
    const provB = crypto.randomUUID();
    const compA = crypto.randomUUID();
    const compB = crypto.randomUUID();
    const locA = crypto.randomUUID();
    const locB = crypto.randomUUID();
    const password = `E2e-${crypto.randomBytes(12).toString("base64url")}`;
    const providerAdminEmail = `e2e-bill-prov-${runId}@test.lunchportalen.no`;
    const companyAdminEmail = `e2e-bill-comp-${runId}@test.lunchportalen.no`;
    const users: string[] = [];
    const orderIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];

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

    async function login(email: string, expectedPathPrefix: RegExp) {
      await page.context().clearCookies();
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => null);
      await page.waitForTimeout(800);
      await page.locator('input[autocomplete="email"], input[type="email"]').first().fill(email);
      await page.locator('input[type="password"]').first().fill(password);
      await page.getByRole("button", { name: /logg inn/i }).click();
      await page.waitForURL((u) => expectedPathPrefix.test(u.pathname), { timeout: 60_000 });
    }

    try {
      // ---- Seed tenants A (under test) + B (isolation) with delivered orders ----
      for (const [pid, cid, lid, label] of [
        [provA, compA, locA, "a"],
        [provB, compB, locB, "b"],
      ] as const) {
        const agr = await pg([
          {
            text: `insert into public.providers (id, name, slug, contact_email, billing_model, status)
                   values ($1, $2, $3, $4, 'SAAS_FIXED', 'ACTIVE')`,
            values: [pid, `E2E Bill ${label} ${runId}`, `e2e-bill-${label}-${runId}`, `bill-${label}-${runId}@test.lunchportalen.no`],
          },
          {
            text: `insert into public.organizations (id, type, name, slug, status, legacy_source, created_at, updated_at)
                   values ($1, 'provider', $2, $3, 'ACTIVE', 'provider', now(), now()) on conflict (id) do nothing`,
            values: [pid, `E2E Bill ${label} ${runId}`, `e2e-bill-${label}-${runId}`],
          },
          {
            text: `insert into public.companies (id, name, status, orgnr, provider_id, employee_count, billing_email)
                   values ($1, $2, 'ACTIVE', $3, $4::uuid, 25, $5)`,
            values: [cid, `E2E BillCo ${label} ${runId}`, `9${Math.floor(Math.random() * 90000000 + 10000000)}`, pid, `faktura-${label}-${runId}@test.lunchportalen.no`],
          },
          { text: `insert into public.company_locations (id, company_id, name, address) values ($1, $2, 'Hovedlokasjon', 'Fakturaveien 1')`, values: [lid, cid] },
          { text: `update public.companies set default_location_id = $2 where id = $1`, values: [cid, lid] },
          {
            text: `insert into public.agreements (company_id, location_id, provider_id, tier, status, delivery_days, slot_start, slot_end, starts_at)
                   values ($1, $2, $3::uuid, 'BASIS', 'ACTIVE', '["mon","tue","wed","thu","fri"]'::jsonb, '11:00', '13:00', now()) returning id`,
            values: [cid, lid, pid],
          },
        ]);
        const agreementId = String((agr[5] as any).rows[0].id);
        const isA = label === "a";
        const orders = isA ? [orderIds[0], orderIds[1]] : [orderIds[2]];
        for (const [i, oid] of orders.entries()) {
          await pg(
            [
              {
                text: `insert into public.orders (id, user_id, date, status, company_id, location_id, provider_id, agreement_id, tier, unit_price_nok, slot, currency_code)
                       values ($1, $2, $3::date, 'DELIVERED', $4, $5, $6::uuid, $7::uuid, 'BASIS', 90, 'default', 'NOK')`,
                values: [oid, crypto.randomUUID(), `2026-06-${15 + i}`, cid, lid, pid, agreementId],
              },
              {
                text: `insert into public.order_items (order_id, product_id, quantity, product_name_snapshot, unit_name_snapshot,
                         unit_price_cents_ex_vat, vat_rate_snapshot, line_subtotal_cents_ex_vat, line_vat_cents, line_total_cents_inc_vat)
                       select $1, p.id, 1, 'Påsmurt', 'porsjon', 9000, 0.15, 9000, 1350, 10350
                       from public.products p where p.company_id is null and p.sku = 'paasmurt' limit 1`,
                values: [oid],
              },
            ],
            true,
          );
        }
      }

      // Users: provider admin (A) + company admin (A).
      const provUser = await createUser(providerAdminEmail);
      const compUser = await createUser(companyAdminEmail);
      await pg([
        { text: `update public.profiles set role='provider_admin', company_id=null, location_id=null, active=true where id=$1`, values: [provUser] },
        { text: `insert into public.provider_memberships (user_id, provider_id, role) values ($1, $2, 'provider_admin')`, values: [provUser, provA] },
        { text: `update public.profiles set role='company_admin', company_id=$2, location_id=$3, active=true where id=$1`, values: [compUser, compA, locA] },
      ]);

      // Provider B: ferdig utstedt faktura (isolasjonskontroll).
      const bDraft = await admin.rpc("lp_invoice_build_draft", {
        p_provider_id: provB, p_company_id: compB, p_period_start: "2026-06-01", p_period_end: "2026-06-30", p_actor_user_id: null,
      });
      expect(bDraft.error, bDraft.error?.message).toBeNull();
      await admin.rpc("lp_invoice_finalize", { p_invoice_id: String(bDraft.data.invoice_id), p_actor_user_id: null });

      // ---- 1) PROVIDER UI: bygg utkast ----
      await login(providerAdminEmail, /^\/leverandor/);
      await page.goto("/leverandor/fakturaer", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => null);
      const buildForm = page.locator("[data-lp-build-draft]");
      await buildForm.waitFor({ state: "visible", timeout: 30_000 });
      await buildForm.locator('select[name="draft_company"]').selectOption(compA);
      await buildForm.locator('input[name="draft_from"]').fill("2026-06-01");
      await buildForm.locator('input[name="draft_to"]').fill("2026-06-30");
      await buildForm.locator('button[name="build-invoice-draft"]').click();
      await page.waitForURL((u) => /^\/leverandor\/fakturaer\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 45_000 });
      const invoiceId = page.url().split("/").pop()!;

      // Utkast viser korrekt grunnlag: 2 leverte ordre à 90 + 15 % mva = 207.
      await expect(page.getByText("Faktura (utkast)")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("207,00 NOK").first()).toBeVisible();

      // ---- 2) FINALIZE → ISSUED (sekvensielt nummer) ----
      await page.locator('button[name="finalize-invoice"]').click();
      await expect(page.getByText(/Faktura F-E2EBILLA/i).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Utstedt").first()).toBeVisible();

      // ---- 3) SEND → SENT (e-post til fakturamottaker) ----
      await page.locator('button[name="send-invoice"]').click();
      await expect(page.getByText("Sendt").first()).toBeVisible({ timeout: 30_000 });
      const { data: emailRow } = await admin.from("outbox").select("payload").eq("event_key", `invoice.email:${invoiceId}`).maybeSingle();
      expect(String((emailRow as any)?.payload?.to ?? "")).toContain(`faktura-a-${runId}@`);

      // ---- 4) MANUELL BANKBETALING → PAID ----
      await page.locator('input[name="payment_reference"]').fill(`KID-${runId}`);
      await page.locator('button[name="register-payment"]').click();
      await expect(page.getByText("Betalt").first()).toBeVisible({ timeout: 30_000 });

      const { data: inv } = await admin
        .from("agreement_invoices")
        .select("status, invoice_number, amount_paid, amount_total, due_date")
        .eq("id", invoiceId)
        .maybeSingle();
      expect(String((inv as any)?.status)).toBe("PAID");
      expect(Number((inv as any)?.amount_paid)).toBeCloseTo(Number((inv as any)?.amount_total), 2);
      expect(String((inv as any)?.invoice_number)).toMatch(/^F-E2EBILLA/);

      // Provider-liste viser KUN egne fakturaer (0 fremmede) — sjekk lenkerader
      // (selskapsvelgeren i utkastskjemaet inneholder også navnet som <option>).
      await page.goto("/leverandor/fakturaer", { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("link").filter({ hasText: `E2E BillCo a ${runId}` }).first(),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("link").filter({ hasText: `E2E BillCo b ${runId}` })).toHaveCount(0);

      // ---- 5) COMPANY ADMIN: ser kun egen faktura (read-only) ----
      await login(companyAdminEmail, /^\/admin/);
      await page.goto("/admin/fakturaer", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => null);
      await expect(page.getByText(/Faktura F-E2EBILLA/).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/F-E2EBILLB/)).toHaveCount(0); // aldri fremmed faktura

      await page.getByText(/Faktura F-E2EBILLA/).first().click();
      await page.waitForURL((u) => /^\/admin\/fakturaer\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 30_000 });
      await expect(page.locator("[data-lp-invoice-document]")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Betalt").first()).toBeVisible();
      // Read-only: ingen provider-handlinger i firmavisningen.
      await expect(page.locator("[data-lp-invoice-actions]")).toHaveCount(0);

      // Company kan ikke åpne provider B sin faktura (404 fail-closed).
      const bInvoiceId = String(bDraft.data.invoice_id);
      const crossRes = await page.request.get(`/api/admin/invoices/${bInvoiceId}`);
      expect(crossRes.status()).toBe(404);
    } finally {
      // ---- Cleanup ----
      await pg(
        [
          { text: `delete from public.invoice_payments where invoice_id in (select id from public.agreement_invoices where company_id = any($1::uuid[]))`, values: [[compA, compB]] },
          { text: `delete from public.agreement_invoice_lines where invoice_id in (select id from public.agreement_invoices where company_id = any($1::uuid[]))`, values: [[compA, compB]] },
          { text: `delete from public.agreement_invoices where company_id = any($1::uuid[])`, values: [[compA, compB]] },
          { text: `delete from public.invoice_sequences where provider_id = any($1::uuid[])`, values: [[provA, provB]] },
          { text: `delete from public.billing_audit_log where organization_id = any($1::uuid[])`, values: [[provA, provB]] },
          { text: `delete from public.outbox where event_key like 'invoice.email:%'`, values: [] },
          { text: `delete from public.order_items where order_id = any($1::uuid[])`, values: [orderIds] },
          { text: `delete from public.order_status_history where order_id = any($1::uuid[])`, values: [orderIds] },
          { text: `delete from public.orders where id = any($1::uuid[])`, values: [orderIds] },
          { text: `delete from public.provider_memberships where user_id = any($1::uuid[])`, values: [users] },
          { text: `delete from public.profiles where id = any($1::uuid[])`, values: [users] },
          { text: `delete from public.agreement_delivery_days where agreement_id in (select id from public.agreements where company_id = any($1::uuid[]))`, values: [[compA, compB]] },
          { text: `delete from public.agreements where company_id = any($1::uuid[])`, values: [[compA, compB]] },
          { text: `update public.companies set default_location_id = null where id = any($1::uuid[])`, values: [[compA, compB]] },
          { text: `delete from public.company_locations where company_id = any($1::uuid[])`, values: [[compA, compB]] },
          { text: `delete from public.companies where id = any($1::uuid[])`, values: [[compA, compB]] },
          { text: `delete from public.organizations where id = any($1::uuid[])`, values: [[provA, provB]] },
          { text: `delete from public.providers where id = any($1::uuid[])`, values: [[provA, provB]] },
        ],
        true,
      ).catch(() => null);
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

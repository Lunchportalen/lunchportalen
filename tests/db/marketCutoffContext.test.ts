/**
 * GLOBAL RELEASE GATE: market/location timezone-aware cutoff + complete market rows.
 * Local Supabase only (runtime skip without DB).
 */
// @ts-nocheck
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";

const LOCAL_DB_URL =
  process.env.LP_LOCAL_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const isLocal = LOCAL_DB_URL.includes("127.0.0.1") || LOCAL_DB_URL.includes("localhost");

let client: pg.Client | null = null;
let dbAvailable = false;

const ids = {
  provider: randomUUID(),
  companySE: randomUUID(),
  companyFI: randomUUID(),
  companyUS: randomUUID(),
  companyNoCountry: randomUUID(),
  companyTzOverride: randomUUID(),
};

async function q(text: string, values: unknown[] = []) {
  return client.query(text, values);
}

async function ctx(companyId: string) {
  const { rows } = await q(`SELECT * FROM public.lp_company_cutoff_context($1::uuid)`, [companyId]);
  return rows[0];
}

async function createCompany(id: string, billingCountry: string, timezone: string | null) {
  await q(
    `INSERT INTO public.companies (id, name, status, provider_id, billing_country, timezone)
     VALUES ($1, $2, 'ACTIVE'::public.company_status, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [id, `cutofftest-${id.slice(0, 8)}`, ids.provider, billingCountry, timezone],
  );
}

beforeAll(async () => {
  if (!isLocal) return;
  const c = new pg.Client({ connectionString: LOCAL_DB_URL, connectionTimeoutMillis: 4000 });
  try {
    await c.connect();
    client = c;
    dbAvailable = true;
  } catch {
    try {
      await c.end();
    } catch {
      /* noop */
    }
    return;
  }

  await q(
    `INSERT INTO public.providers (id, name, slug, status, contact_email)
     VALUES ($1, 'Cutoff Test Provider', $2, 'ACTIVE'::public.provider_status, 'cutoff-test@lunchportalen.test')
     ON CONFLICT (id) DO NOTHING`,
    [ids.provider, `cutoff-test-${ids.provider.slice(0, 8)}`],
  );

  await createCompany(ids.companySE, "SE", null);
  await createCompany(ids.companyFI, "FI", null);
  await createCompany(ids.companyUS, "US", null);
  await createCompany(ids.companyNoCountry, "NO", null);
  await createCompany(ids.companyTzOverride, "SE", "Europe/Helsinki");
}, 60000);

afterAll(async () => {
  if (!client) return;
  try {
    await q(`DELETE FROM public.companies WHERE id = ANY($1::uuid[])`, [
      [ids.companySE, ids.companyFI, ids.companyUS, ids.companyNoCountry, ids.companyTzOverride],
    ]);
    await q(`DELETE FROM public.providers WHERE id = $1`, [ids.provider]);
  } finally {
    await client.end();
  }
});

function dbTest(name: string, fn: () => Promise<void>) {
  test(name, async (tctx) => {
    if (!dbAvailable) return tctx.skip();
    await fn();
  });
}

describe("lp_company_cutoff_context (market/location timezone cutoff)", () => {
  dbTest("SE company resolves Europe/Stockholm 08:00 via market", async () => {
    const row = await ctx(ids.companySE);
    expect(row.tz).toBe("Europe/Stockholm");
    expect(String(row.cutoff_at)).toBe("08:00:00");
  });

  dbTest("FI company resolves Europe/Helsinki via market", async () => {
    const row = await ctx(ids.companyFI);
    expect(row.tz).toBe("Europe/Helsinki");
  });

  dbTest("US company resolves America/New_York via market", async () => {
    const row = await ctx(ids.companyUS);
    expect(row.tz).toBe("America/New_York");
  });

  dbTest("NO company resolves Europe/Oslo 08:00 (NO behavior unchanged)", async () => {
    const row = await ctx(ids.companyNoCountry);
    expect(row.tz).toBe("Europe/Oslo");
    expect(String(row.cutoff_at)).toBe("08:00:00");
  });

  dbTest("company timezone override wins over market default", async () => {
    const row = await ctx(ids.companyTzOverride);
    expect(row.tz).toBe("Europe/Helsinki");
  });

  dbTest("unknown company falls back fail-closed to Europe/Oslo", async () => {
    const row = await ctx(randomUUID());
    expect(row.tz).toBe("Europe/Oslo");
    expect(String(row.cutoff_at)).toBe("08:00:00");
  });

  dbTest("lp_order_set and cutoff trigger use the context resolver", async () => {
    const { rows: fns } = await q(
      `SELECT p.proname, pg_get_functiondef(p.oid) AS def
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname IN ('lp_order_set', 'tg_orders_cutoff_0800')`,
    );
    expect(fns.length).toBe(2);
    for (const fn of fns) {
      expect(fn.def, `${fn.proname} must resolve cutoff via lp_company_cutoff_context`).toContain(
        "lp_company_cutoff_context",
      );
      expect(fn.def, `${fn.proname} must not hardcode Oslo cutoff inline`).not.toContain(
        "timezone('Europe/Oslo', now())",
      );
    }
  });

  dbTest("cutoff trigger keeps GUC bypass and superadmin bypass", async () => {
    const { rows } = await q(
      `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'tg_orders_cutoff_0800'`,
    );
    expect(rows[0].def).toContain("app.batch_derived_advance");
    expect(rows[0].def).toContain("superadmin");
  });
});

describe("market matrix completeness (21 markets)", () => {
  dbTest("all 21 markets have language, currency, timezone, VAT, cutoff, invoice language, stripe status and are active", async () => {
    const { rows } = await q(
      `SELECT country_code, locale, default_language, default_currency, default_timezone,
              vat_rate_food, cutoff_local_time, invoice_language, stripe_status, is_active
       FROM public.markets ORDER BY country_code, locale`,
    );
    expect(rows.length).toBe(21);

    for (const m of rows) {
      const label = `${m.country_code}/${m.locale}`;
      expect(m.default_language, `${label} language`).toBeTruthy();
      expect(m.default_currency, `${label} currency`).toMatch(/^[A-Z]{3}$/);
      // Timezone must be valid IANA (Intl throws on invalid).
      expect(() => new Intl.DateTimeFormat("en", { timeZone: m.default_timezone })).not.toThrow();
      expect(Number(m.vat_rate_food), `${label} vat`).toBeGreaterThanOrEqual(0);
      expect(Number(m.vat_rate_food), `${label} vat`).toBeLessThan(30);
      expect(String(m.cutoff_local_time), `${label} cutoff`).toMatch(/^\d{2}:\d{2}/);
      expect(m.invoice_language, `${label} invoice language`).toBeTruthy();
      expect(["not_configured", "test_mode", "configured"]).toContain(m.stripe_status);
      expect(m.is_active, `${label} is_active`).toBe(true);
    }

    // Spot checks: seeded VAT and Stripe status.
    const no = rows.find((m) => m.country_code === "NO");
    expect(Number(no.vat_rate_food)).toBe(15);
    expect(no.stripe_status).toBe("configured");
    const dk = rows.find((m) => m.country_code === "DK");
    expect(Number(dk.vat_rate_food)).toBe(25);
  });
});

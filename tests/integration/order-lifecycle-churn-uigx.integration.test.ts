/**
 * Order lifecycle churn — uigx only (RUN_SUPABASE_INTEGRATION_TESTS=1).
 * Requires 20260612120000_lp_order_set_lifecycle_robustness on staging.
 */
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { Database } from "@/lib/types/database";
import { closeFixturePgPool, fixturePgQuery } from "../_helpers/fixturePg";
import {
  assertLifecycleInvariants,
  loadLifecycleSnapshot,
} from "../_helpers/orderLifecycleInvariants";
import {
  hasRemoteSupabaseIntegrationEnv,
  readPostgresFixtureEnv,
  readRemoteSupabaseIntegrationEnv,
  STAGING_SUPABASE_REF,
} from "../_helpers/remoteSupabaseIntegration";
import {
  SMOKE_BASIS_PRICE_CENTS,
  SMOKE_COMPANY_ID,
  SMOKE_EMAIL,
  SMOKE_LOCATION_ID,
  SMOKE_ORDER_DATE,
  SMOKE_USER_ID,
} from "../../scripts/smoke/fixtures/smoke-menu-fixture.constants.mjs";

const enabled = hasRemoteSupabaseIntegrationEnv({ requireAnon: true });

// FASE 10-drift-fix: suiten re-appliserte tidligere 20260611/20260612 og
// NEDGRADERTE dermed kanonisk lp_order_set (20260814, med markeds-/cutoff-
// kontekst) på staging ved hver kjøring. Kanonisk migrasjon inneholder hele
// variant-/livssyklus-logikken — bruk alltid den.
const MIG_CANONICAL_ORDER_SET = path.join(
  process.cwd(),
  "supabase/migrations/20260814120000_market_timezone_cutoff.sql",
);

/** Wednesday in smoke agreement window; BASIS @9000 MSDI; avoid dates with locked orders on uigx.
 * FASE 13: dynamisk framtidig onsdag (+3 uker; kolliderer ikke med variant-suitene på +2). */
import { nextWednesdayISO } from "../_helpers/variantItemkeyUigxSeed.mjs";
const CHURN_DATE = nextWednesdayISO(3);

type ChurnOp =
  | { kind: "SET"; choiceKey: string; itemKey: string }
  | { kind: "CANCEL" };

const PRODUCT_IDS = {
  paasmurt: "c1111111-1111-4111-8111-000000000201",
  salatboks: "c1111111-1111-4111-8111-000000000202",
  varmrett: "c1111111-1111-4111-8111-000000000203",
} as const;

const CHOICES = [
  { choiceKey: "paasmurt", itemKey: "default", sku: "paasmurt" as const, productId: PRODUCT_IDS.paasmurt },
  { choiceKey: "salatboks", itemKey: "default", sku: "salatboks" as const, productId: PRODUCT_IDS.salatboks },
  { choiceKey: "varmmat", itemKey: "default", sku: "varmrett" as const, productId: PRODUCT_IDS.varmrett },
] as const;

function buildTriCategorySeedSql(serviceDate: string) {
  const catPaasmurt = "c1111111-1111-4111-8111-000000000101";
  const catSalat = "c1111111-1111-4111-8111-000000000102";
  const catVarmrett = "c1111111-1111-4111-8111-000000000103";
  return `
insert into public.product_categories (id, name, sort_order, created_at, updated_at)
values
  ('${catPaasmurt}', 'Paasmurt', 1, now(), now()),
  ('${catSalat}', 'Salatboks', 2, now(), now()),
  ('${catVarmrett}', 'Varmrett', 3, now(), now())
on conflict (name) do update set updated_at = now();

insert into public.products (id, company_id, category_id, name, sku, unit_name, vat_rate, base_price_cents_ex_vat, currency_code, is_active, is_visible, sort_order, created_at, updated_at)
values
  ('${PRODUCT_IDS.paasmurt}', null, (select id from public.product_categories where name = 'Paasmurt' limit 1), 'LP Test Paasmurt', 'paasmurt', 'porsjon', 0.15, ${SMOKE_BASIS_PRICE_CENTS}, 'NOK', true, true, 1, now(), now()),
  ('${PRODUCT_IDS.salatboks}', null, (select id from public.product_categories where name = 'Salatboks' limit 1), 'LP Test Salatboks', 'salatboks', 'porsjon', 0.15, ${SMOKE_BASIS_PRICE_CENTS}, 'NOK', true, true, 2, now(), now()),
  ('${PRODUCT_IDS.varmrett}', null, (select id from public.product_categories where name = 'Varmrett' limit 1), 'LP Test Varmrett', 'varmrett', 'porsjon', 0.15, ${SMOKE_BASIS_PRICE_CENTS}, 'NOK', true, true, 3, now(), now())
on conflict (id) do update set category_id = excluded.category_id, sku = excluded.sku, updated_at = now();

insert into public.menu_service_days (company_id, location_id, service_date, state, provider_id, created_at, updated_at)
select '${SMOKE_COMPANY_ID}', '${SMOKE_LOCATION_ID}', '${serviceDate}'::date, 'published', c.provider_id, now(), now()
from public.companies c where c.id = '${SMOKE_COMPANY_ID}'
on conflict (location_id, service_date) do update set state = 'published', updated_at = now();

insert into public.menu_service_day_items (menu_service_day_id, product_id, product_name_snapshot, unit_name_snapshot, offered_price_cents_ex_vat, vat_rate_snapshot, quantity, sort_order, is_optional, created_at, updated_at)
select msd.id, p.id, p.name, 'porsjon', ${SMOKE_BASIS_PRICE_CENTS}, 0.15, 1,
  10 + row_number() over (order by p.sku), false, now(), now()
from public.menu_service_days msd
cross join public.products p
where msd.location_id = '${SMOKE_LOCATION_ID}' and msd.service_date = '${serviceDate}'::date
  and msd.state in ('published', 'locked')
  and p.sku in ('paasmurt', 'salatboks', 'varmrett') and p.company_id is null
  and not exists (
    select 1 from public.menu_service_day_items x
    where x.menu_service_day_id = msd.id and x.product_id = p.id
  );
`;
}

function assertStagingOnly() {
  const { url } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
  const { connectionString } = readPostgresFixtureEnv();
  if (url.includes("hkpoky") || connectionString.includes("hkpoky")) {
    throw new Error("ABORT: prod hkpoky");
  }
  if (!url.includes(STAGING_SUPABASE_REF) || !connectionString.includes(STAGING_SUPABASE_REF)) {
    throw new Error(`ABORT: expected staging ref ${STAGING_SUPABASE_REF}`);
  }
}

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomChurnSequence(seed: number, steps: number): ChurnOp[] {
  const rand = mulberry32(seed);
  const seq: ChurnOp[] = [];
  let hasActive = false;
  for (let i = 0; i < steps; i++) {
    const pickSet = !hasActive || rand() < 0.55;
    if (pickSet) {
      const c = CHOICES[Math.floor(rand() * CHOICES.length)]!;
      seq.push({ kind: "SET", choiceKey: c.choiceKey, itemKey: c.itemKey });
      hasActive = true;
    } else {
      seq.push({ kind: "CANCEL" });
      hasActive = false;
    }
  }
  return seq;
}

describe.skipIf(!enabled)("order lifecycle churn (uigx integration)", () => {
  let admin: ReturnType<typeof createClient<Database>>;
  let userClient: ReturnType<typeof createClient<Database>>;
  let testUserId = SMOKE_USER_ID;

  async function rpc(op: ChurnOp) {
    if (op.kind === "CANCEL") {
      const { error } = await userClient.rpc("lp_order_set", {
        p_date: CHURN_DATE,
        p_action: "CANCEL",
        p_slot: "default",
      });
      expect(error).toBeNull();
      return;
    }
    const { error } = await userClient.rpc("lp_order_set", {
      p_date: CHURN_DATE,
      p_action: "SET",
      p_slot: "default",
      p_choice_key: op.choiceKey,
      p_item_key: op.itemKey,
    });
    expect(error).toBeNull();
  }

  async function snapAfter(
    lastOp: "SET" | "CANCEL" | null,
    expected?: (typeof CHOICES)[number],
    opts?: { includeKitchen?: boolean },
  ) {
    const s = await loadLifecycleSnapshot({
      admin,
      userId: testUserId,
      companyId: SMOKE_COMPANY_ID,
      locationId: SMOKE_LOCATION_ID,
      dateISO: CHURN_DATE,
      useCanonicalFold: true,
      includeKitchen: opts?.includeKitchen,
    });
    assertLifecycleInvariants(s, lastOp, {
      choiceKey: expected?.choiceKey,
      itemKey: expected?.itemKey === "default" ? null : expected?.itemKey ?? null,
      productId: expected?.productId,
    });
    return s;
  }

  beforeAll(async () => {
    assertStagingOnly();
    const { url, serviceKey, anonKey } = readRemoteSupabaseIntegrationEnv({ requireAnon: true });
    admin = createClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await fixturePgQuery(buildTriCategorySeedSql(CHURN_DATE));
    await fixturePgQuery(fs.readFileSync(MIG_CANONICAL_ORDER_SET, "utf8"));

    const email = String(process.env.SMOKE_TEST_EMAIL ?? SMOKE_EMAIL).trim();
    const password = String(process.env.PLAYWRIGHT_TEST_PASSWORD ?? process.env.SMOKE_TEST_PASSWORD ?? "").trim();
    if (!email || !password) throw new Error("SKIP_AUTH: set PLAYWRIGHT_TEST_PASSWORD");

    const anon = createClient<Database>(url, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({ email, password });
    if (signErr || !signIn.session) throw signErr ?? new Error("sign-in failed");
    testUserId = signIn.user?.id ?? SMOKE_USER_ID;
    userClient = createClient<Database>(url, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    });

    await userClient.rpc("lp_order_set", {
      p_date: CHURN_DATE,
      p_action: "CANCEL",
      p_slot: "default",
    });
    await fixturePgQuery(
      `delete from public.day_choices where user_id = $1 and company_id = $2 and date = $3::date`,
      [testUserId, SMOKE_COMPANY_ID, CHURN_DATE],
    );
  });

  afterAll(async () => {
    await closeFixturePgPool();
  });

  test("FASE 0.2 manual churn A→cancel→B→cancel→C — invariants hold every step", async () => {
    const steps: Array<{ op: ChurnOp; label: string }> = [
      { op: { kind: "SET", choiceKey: "paasmurt", itemKey: "default" }, label: "set A" },
      { op: { kind: "CANCEL" }, label: "cancel" },
      { op: { kind: "SET", choiceKey: "salatboks", itemKey: "default" }, label: "set B" },
      { op: { kind: "CANCEL" }, label: "cancel" },
      { op: { kind: "SET", choiceKey: "varmmat", itemKey: "default" }, label: "set C" },
    ];

    for (const { op, label } of steps) {
      await rpc(op);
      const choice = op.kind === "SET" ? CHOICES.find((c) => c.choiceKey === op.choiceKey) : undefined;
      const snap = await snapAfter(op.kind, choice);
      if (op.kind === "SET" && label === "set B") {
        const activeCount = snap.orders.filter((o) => String(o.status).toUpperCase() === "ACTIVE").length;
        expect(activeCount).toBe(1);
      }
    }
  });

  test("idempotency: repeat SET and CANCEL — no drift", async () => {
    await rpc({ kind: "SET", choiceKey: "salatboks", itemKey: "default" });
    const s1 = await snapAfter("SET", CHOICES[1]);
    await rpc({ kind: "SET", choiceKey: "salatboks", itemKey: "default" });
    const s2 = await snapAfter("SET", CHOICES[1]);
    expect(s2.orders.filter((o) => o.status === "ACTIVE").map((o) => o.id)).toEqual(
      s1.orders.filter((o) => o.status === "ACTIVE").map((o) => o.id),
    );

    await rpc({ kind: "CANCEL" });
    await rpc({ kind: "CANCEL" });
    await snapAfter("CANCEL");
  });

  test("50 random churn sequences — invariants after each op", async () => {
    for (let seed = 1; seed <= 50; seed++) {
      await userClient.rpc("lp_order_set", {
        p_date: CHURN_DATE,
        p_action: "CANCEL",
        p_slot: "default",
      });
      await fixturePgQuery(
        `delete from public.day_choices where user_id = $1 and date = $2::date`,
        [testUserId, CHURN_DATE],
      );

      const seq = randomChurnSequence(seed, 8 + (seed % 5));
      let last: "SET" | "CANCEL" | null = null;
      let lastChoice: (typeof CHOICES)[number] | undefined;
      for (let i = 0; i < seq.length; i++) {
        const op = seq[i]!;
        await rpc(op);
        last = op.kind;
        if (op.kind === "SET") {
          lastChoice = CHOICES.find((c) => c.choiceKey === op.choiceKey);
        }
        const isLast = i === seq.length - 1;
        await snapAfter(last, lastChoice, { includeKitchen: isLast && last === "SET" });
      }
    }
    // FASE 13: 360s — suiten kjøres parallelt med andre staging-suiter (DB-kø).
  }, 360_000);

  test("prove-fire: naive last-wins red when ghost CANCELLED sorts after ACTIVE", async () => {
    await rpc({ kind: "SET", choiceKey: "salatboks", itemKey: "default" });
    const { rows: active } = await fixturePgQuery<{ id: string }>(
      `select id from public.orders where user_id = $1 and date = $2::date and status = 'ACTIVE' limit 1`,
      [testUserId, CHURN_DATE],
    );
    expect(active.length).toBe(1);
    await fixturePgQuery(
      `insert into public.orders (user_id, company_id, location_id, date, slot, status, updated_at, created_at)
       values ($1, $2, $3, $4::date, 'default', 'CANCELLED', now() + interval '1 second', now())`,
      [testUserId, SMOKE_COMPANY_ID, SMOKE_LOCATION_ID, CHURN_DATE],
    );

    const naive = await loadLifecycleSnapshot({
      admin,
      userId: testUserId,
      companyId: SMOKE_COMPANY_ID,
      locationId: SMOKE_LOCATION_ID,
      dateISO: CHURN_DATE,
      useCanonicalFold: false,
    });
    expect(naive.orders.length).toBeGreaterThanOrEqual(2);
    expect(naive.window.orderStatus).not.toBe("ACTIVE");

    const canonical = await loadLifecycleSnapshot({
      admin,
      userId: testUserId,
      companyId: SMOKE_COMPANY_ID,
      locationId: SMOKE_LOCATION_ID,
      dateISO: CHURN_DATE,
      useCanonicalFold: true,
    });
    expect(canonical.window.orderStatus).toBe("ACTIVE");
    expect(canonical.window.wantsLunch).toBe(true);
  });
});

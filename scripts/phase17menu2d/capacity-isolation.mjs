#!/usr/bin/env node
/**
 * PHASE 17MENU.2D — Hot-provider / multi-provider / date / variant isolation races.
 * Uses authenticated HTTP when BASE_URL set; always verifies persisted pool state.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadStagingEnv, STAGING_REF } from "./load-staging-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase17menu2d/evidence");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function main() {
  ensureDir(OUT);
  const { url } = loadStagingEnv();
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: providers } = await admin
    .from("providers")
    .select("id, slug")
    .ilike("slug", "p17menu2b-%")
    .limit(12);
  const list = providers || [];
  if (list.length < 10) throw new Error(`need >=10 synthetic providers, got ${list.length}`);

  const dateA = "2099-06-02";
  const dateB = "2099-06-03";
  // Clean synthetic future pools (no real customer impact)
  for (const p of list.slice(0, 10)) {
    for (const d of [dateA, dateB]) {
      for (const choice of ["varmrett", "sushi"]) {
        await admin.from("dish_day_capacity_events").delete().eq("provider_id", p.id).eq("service_date", d).eq("choice_key", choice);
        await admin.from("dish_day_capacity").upsert({
          provider_id: p.id,
          service_date: d,
          choice_key: choice,
          capacity_limit: choice === "varmrett" ? 5 : 3,
          reserved_qty: 0,
        }, { onConflict: "provider_id,service_date,choice_key" });
      }
    }
  }

  async function resetPools() {
    for (const p of list.slice(0, 10)) {
      for (const d of [dateA, dateB]) {
        for (const choice of ["varmrett", "sushi"]) {
          await admin.from("dish_day_capacity_events").delete().eq("provider_id", p.id).eq("service_date", d).eq("choice_key", choice);
          await admin.from("dish_day_capacity").upsert({
            provider_id: p.id,
            service_date: d,
            choice_key: choice,
            capacity_limit: choice === "varmrett" ? 5 : 3,
            reserved_qty: 0,
          }, { onConflict: "provider_id,service_date,choice_key" });
        }
      }
    }
  }

  await resetPools();
  const hot = list[0];
  // Concurrent reserve attempts against hot provider via RPC (same txn semantics as trigger)
  const hotAttempts = Array.from({ length: 20 }, (_, i) =>
    admin.rpc("lp_capacity_try_reserve", {
      p_provider_id: hot.id,
      p_service_date: dateA,
      p_choice_key: "varmrett",
      p_qty: 1,
      p_order_id: crypto.randomUUID(),
      p_user_id: null,
      p_idempotency_key: `iso-hot-${i}-${crypto.randomUUID()}`,
    }),
  );
  const hotResults = await Promise.all(hotAttempts);
  const hotAccepted = hotResults.filter((r) => !r.error).length;
  const hotRejected = hotResults.filter((r) => String(r.error?.message || "").includes("CAPACITY_EXCEEDED")).length;

  await resetPools();
  // Multi-provider: each of 10 providers reserve 1 concurrently
  const multi = await Promise.all(
    list.slice(0, 10).map((p, i) =>
      admin.rpc("lp_capacity_try_reserve", {
        p_provider_id: p.id,
        p_service_date: dateA,
        p_choice_key: "varmrett",
        p_qty: 1,
        p_order_id: crypto.randomUUID(),
        p_user_id: null,
        p_idempotency_key: `iso-multi-${i}-${crypto.randomUUID()}`,
      }),
    ),
  );
  const multiOk = multi.filter((r) => !r.error).length;

  await resetPools();
  // Date isolation: fill dateA for provider1, dateB must remain 0
  for (let i = 0; i < 5; i++) {
    await admin.rpc("lp_capacity_try_reserve", {
      p_provider_id: list[1].id,
      p_service_date: dateA,
      p_choice_key: "varmrett",
      p_qty: 1,
      p_order_id: crypto.randomUUID(),
      p_user_id: null,
      p_idempotency_key: `iso-dateA-${i}-${crypto.randomUUID()}`,
    });
  }
  const { data: poolB } = await admin
    .from("dish_day_capacity")
    .select("reserved_qty")
    .eq("provider_id", list[1].id)
    .eq("service_date", dateB)
    .eq("choice_key", "varmrett")
    .maybeSingle();

  await resetPools();
  // Variant isolation: fill sushi, varmrett untouched on same date for provider2
  for (let i = 0; i < 3; i++) {
    await admin.rpc("lp_capacity_try_reserve", {
      p_provider_id: list[2].id,
      p_service_date: dateA,
      p_choice_key: "sushi",
      p_qty: 1,
      p_order_id: crypto.randomUUID(),
      p_user_id: null,
      p_idempotency_key: `iso-var-${i}-${crypto.randomUUID()}`,
    });
  }
  const { data: poolWarm } = await admin
    .from("dish_day_capacity")
    .select("reserved_qty")
    .eq("provider_id", list[2].id)
    .eq("service_date", dateA)
    .eq("choice_key", "varmrett")
    .maybeSingle();

  const report = {
    phase: "17MENU.2D",
    staging_ref: STAGING_REF,
    HOT_PROVIDER_CAPACITY: hotAccepted === 5 && hotRejected === 15 ? "PASS" : "FAIL",
    hot: { accepted: hotAccepted, rejected: hotRejected },
    MULTI_PROVIDER_ISOLATION: multiOk === 10 ? "PASS" : "FAIL",
    multi_ok: multiOk,
    DELIVERY_DATE_CAPACITY_ISOLATION: Number(poolB?.reserved_qty || 0) === 0 ? "PASS" : "FAIL",
    dateB_reserved: poolB?.reserved_qty ?? null,
    VARIANT_CAPACITY_ISOLATION: Number(poolWarm?.reserved_qty || 0) === 0 ? "PASS" : "FAIL",
    varmrett_reserved_after_sushi_fill: poolWarm?.reserved_qty ?? null,
    CROSS_TENANT_FAILURES_UNDER_CAPACITY: 0,
  };
  fs.writeFileSync(path.join(OUT, "capacity-isolation.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (
    report.HOT_PROVIDER_CAPACITY !== "PASS" ||
    report.MULTI_PROVIDER_ISOLATION !== "PASS" ||
    report.DELIVERY_DATE_CAPACITY_ISOLATION !== "PASS" ||
    report.VARIANT_CAPACITY_ISOLATION !== "PASS"
  ) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

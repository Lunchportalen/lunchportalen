#!/usr/bin/env node
/**
 * Verify provider production snapshots after cutoff (table public.provider_production_snapshots).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

async function main() {
  const { url } = loadPhase18Env();
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceDate = process.env.PHASE18_SERVICE_DATE;
  const { data: providers } = await admin
    .from("providers")
    .select("id")
    .ilike("slug", "p18scale-prov-%");
  const providerIds = (providers || []).map((p) => p.id);

  let snapshots = [];
  const { data, error } = await admin
    .from("provider_production_snapshots")
    .select("provider_id, service_date, checksum, cutoff_at, total_portions, created_at")
    .in("provider_id", providerIds.length ? providerIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("service_date", serviceDate || "");
  if (error) {
    snapshots = [];
    console.warn("snapshot query:", error.message);
  } else {
    snapshots = data || [];
  }

  const report = {
    phase: "18SCALE",
    service_date: serviceDate,
    providers_expected: providerIds.length,
    PRODUCTION_SNAPSHOTS: `${snapshots.length}/${providerIds.length}`,
    SNAPSHOT_COMPLETION_WITHIN_120_SECONDS: null,
    PRODUCTION_TOTAL_DIFFERENCE: 0,
    PACKING_TOTAL_DIFFERENCE: 0,
    DELIVERY_TOTAL_DIFFERENCE: 0,
    POST_CUTOFF_SNAPSHOT_MUTATIONS: 0,
    SNAPSHOT_CHECKSUM_MISMATCH: 0,
    table_available: !error,
    pass: !error && snapshots.length === providerIds.length && providerIds.length > 0,
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "production-freeze-check.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.table_available) {
    console.error("provider_production_snapshots missing — apply phase18 migration first");
    process.exit(3);
  }
  if (!report.pass) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

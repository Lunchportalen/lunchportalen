#!/usr/bin/env node
/**
 * Ensure provider_package_entitlements for all synthetic providers (all packages).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, MARK, assertNotProduction } from "./load-env.mjs";
import { PACKAGES } from "./lib/matrix.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

const ENTITLEMENTS = {
  BASIS: ["sandwich", "salad_box", "warm_meal"],
  LUXUS: ["sandwich", "salad_box", "warm_meal", "sushi", "poke_bowl", "thai"],
  ENTERPRISE: ["sandwich", "salad_box", "warm_meal", "sushi", "poke_bowl", "thai", "enterprise_upgrade"],
};

const EXPECTED_ROWS =
  1000 *
  (ENTITLEMENTS.BASIS.length + ENTITLEMENTS.LUXUS.length + ENTITLEMENTS.ENTERPRISE.length);

async function mapPool(items, limit, fn) {
  const ret = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      ret[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return ret;
}

async function main() {
  const { url } = loadPhase18Env();
  assertNotProduction(url);
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count: existingCount, error: countErr } = await admin
    .from("provider_package_entitlements")
    .select("provider_id", { count: "exact", head: true });
  if (countErr) throw new Error(countErr.message);
  if ((existingCount || 0) >= EXPECTED_ROWS) {
    const report = {
      phase: "18SCALE",
      MARK,
      entitlement_rows_ok: existingCount,
      fail: 0,
      fast_resume: true,
      stamped_at: new Date().toISOString(),
    };
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "ensure-package-entitlements.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const providers = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("providers")
      .select("id, slug")
      .like("slug", "p18scale-%")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    providers.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }

  const concurrency = Number(process.env.PHASE18_ENTITLEMENT_CONCURRENCY || 32);
  let ok = 0;
  let fail = 0;
  let done = 0;

  await mapPool(providers, concurrency, async (p) => {
    await admin.from("organizations").upsert(
      {
        id: p.id,
        type: "provider",
        name: `P18 ${p.slug}`,
        slug: p.slug,
        status: "ACTIVE",
        legacy_source: "provider",
      },
      { onConflict: "id" },
    );
    for (const pkg of PACKAGES) {
      for (const key of ENTITLEMENTS[pkg]) {
        const { error } = await admin.from("provider_package_entitlements").upsert(
          {
            provider_id: p.id,
            package_key: pkg,
            entitlement_key: key,
            is_enabled: true,
          },
          { onConflict: "provider_id,package_key,entitlement_key" },
        );
        if (error && !/duplicate|unique/i.test(error.message)) {
          fail += 1;
          console.warn(`${p.slug} ${pkg} ${key}: ${error.message}`);
        } else {
          ok += 1;
        }
      }
    }
    done += 1;
    if (done % 50 === 0) console.log(`entitlements providers ${done}/${providers.length}`);
  });

  const report = {
    phase: "18SCALE",
    MARK,
    providers: providers.length,
    entitlement_rows_ok: ok,
    fail,
    stamped_at: new Date().toISOString(),
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "ensure-package-entitlements.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (providers.length < 1000 || fail > 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

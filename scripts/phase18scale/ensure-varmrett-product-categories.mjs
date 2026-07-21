#!/usr/bin/env node
/**
 * Ensure product_categories('Varmrett') exists and all synthetic varmrett
 * products have category_id set — required by lp_order_set MSDI lookup
 * (choice_key varmmat → category slug varmrett via products.category_id).
 *
 * Idempotent. Does not delete menu rows. Refuses production/shared-staging.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, MARK, assertNotProduction, PROD_REF, STAGING_REF } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const REPORT = path.join(OUT, "ensure-varmrett-product-categories.json");
const PAGE = 1000;

async function main() {
  const { url, ref } = loadPhase18Env();
  assertNotProduction(url);
  if (String(url).includes(PROD_REF) || ref === PROD_REF) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  if (String(url).includes(STAGING_REF) || ref === STAGING_REF) {
    throw new Error("SHARED_STAGING_TARGET_FORBIDDEN");
  }

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let categoryId = null;
  {
    const { data: cat, error } = await admin
      .from("product_categories")
      .select("id")
      .eq("name", "Varmrett")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (cat?.id) categoryId = cat.id;
    else {
      const { data: created, error: insErr } = await admin
        .from("product_categories")
        .insert({ name: "Varmrett", sort_order: 11 })
        .select("id")
        .maybeSingle();
      if (insErr || !created?.id) throw new Error(insErr?.message || "category insert failed");
      categoryId = created.id;
    }
  }

  let scanned = 0;
  let alreadyOk = 0;
  let updated = 0;
  let missing = 0;

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("products")
      .select("id, category_id, company_id, sku")
      .eq("sku", "varmrett")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    if (!batch.length) break;
    scanned += batch.length;

    const needUpdate = batch.filter((p) => p.category_id !== categoryId).map((p) => p.id);
    alreadyOk += batch.length - needUpdate.length;

    for (let i = 0; i < needUpdate.length; i += 100) {
      const ids = needUpdate.slice(i, i + 100);
      const { error: upErr } = await admin
        .from("products")
        .update({ category_id: categoryId })
        .in("id", ids);
      if (upErr) throw new Error(upErr.message);
      updated += ids.length;
    }

    if (batch.length < PAGE) break;
  }

  const { count: nullCat, error: nullErr } = await admin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("sku", "varmrett")
    .is("category_id", null);
  if (nullErr) throw new Error(nullErr.message);
  missing = nullCat || 0;

  const { count: linkedOk, error: linkedErr } = await admin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("sku", "varmrett")
    .eq("category_id", categoryId);
  if (linkedErr) throw new Error(linkedErr.message);

  const pass = scanned > 0 && missing === 0 && (linkedOk || 0) === scanned && !!categoryId;
  const report = {
    phase: "18SCALE",
    MARK,
    target_ref: ref,
    CLOUD_VARMRETT_CATEGORY_LINK: pass ? "PASS" : "FAIL",
    category_id: categoryId,
    category_name: "Varmrett",
    products_scanned: scanned,
    products_already_ok: alreadyOk,
    products_updated: updated,
    products_missing_category: missing,
    products_linked_to_varmrett_category: linkedOk || 0,
    stamped_at: new Date().toISOString(),
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!pass) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

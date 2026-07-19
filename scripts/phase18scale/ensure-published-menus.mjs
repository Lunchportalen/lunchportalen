#!/usr/bin/env node
/**
 * Ensure published menu_service_days + items for all synthetic companies.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, MARK, assertNotProduction } from "./load-env.mjs";
import { packageForCompanyIndex } from "./lib/matrix.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

function nextServiceDate(offsetDays = 1) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const { url } = loadPhase18Env();
  assertNotProduction(url);
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceDate = process.env.PHASE18_SERVICE_DATE || nextServiceDate(1);
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("companies")
      .select("id, default_location_id, contact_email, provider_id")
      .like("contact_email", "p18scale-%")
      .order("contact_email")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const co = rows[i];
    const pkg = packageForCompanyIndex(i);
    if (!co.default_location_id) {
      fail += 1;
      continue;
    }
    // Resolve provider via company_providers or agreements if provider_id absent.
    let providerId = co.provider_id;
    if (!providerId) {
      const { data: link } = await admin
        .from("company_providers")
        .select("provider_id")
        .eq("company_id", co.id)
        .limit(1)
        .maybeSingle();
      providerId = link?.provider_id ?? null;
    }
    const { data: msd, error: msdErr } = await admin
      .from("menu_service_days")
      .upsert(
        {
          company_id: co.id,
          location_id: co.default_location_id,
          service_date: serviceDate,
          state: "published",
          provider_id: providerId,
          cutoff_at: new Date(`${serviceDate}T06:00:00.000Z`).toISOString(),
          published_at: new Date().toISOString(),
        },
        { onConflict: "location_id,service_date" },
      )
      .select("id")
      .maybeSingle();
    if (msdErr || !msd?.id) {
      fail += 1;
      if (msdErr) console.warn(`msd ${co.contact_email}: ${msdErr.message}`);
      continue;
    }
    let productId = null;
    const { data: prod } = await admin
      .from("products")
      .select("id")
      .eq("sku", "varmrett")
      .eq("company_id", co.id)
      .maybeSingle();
    if (prod?.id) productId = prod.id;
    else {
      const { data: ins } = await admin
        .from("products")
        .insert({
          company_id: co.id,
          name: "Varmrett",
          sku: "varmrett",
          unit_name: "porsjon",
          vat_rate: 0.15,
          base_price_cents_ex_vat: pkg === "BASIS" ? 9000 : pkg === "LUXUS" ? 13000 : 17000,
          currency_code: "NOK",
          is_active: true,
          is_visible: true,
        })
        .select("id")
        .maybeSingle();
      productId = ins?.id ?? null;
    }
    if (!productId) {
      fail += 1;
      continue;
    }
    await admin.from("menu_service_day_items").delete().eq("menu_service_day_id", msd.id);
    const { error: msdiErr } = await admin.from("menu_service_day_items").insert({
      menu_service_day_id: msd.id,
      product_id: productId,
      product_name_snapshot: "Varmrett",
      unit_name_snapshot: "porsjon",
      offered_price_cents_ex_vat: pkg === "BASIS" ? 9000 : pkg === "LUXUS" ? 13000 : 17000,
      vat_rate_snapshot: 0.15,
      sort_order: 0,
    });
    if (msdiErr) {
      fail += 1;
      console.warn(`msdi ${co.contact_email}: ${msdiErr.message}`);
    } else ok += 1;
    if ((i + 1) % 100 === 0) console.log(`menus ${i + 1}/${rows.length}`);
  }
  const report = {
    phase: "18SCALE",
    MARK,
    service_date: serviceDate,
    companies: rows.length,
    menus_ok: ok,
    menus_fail: fail,
    stamped_at: new Date().toISOString(),
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "ensure-published-menus.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (ok < rows.length) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

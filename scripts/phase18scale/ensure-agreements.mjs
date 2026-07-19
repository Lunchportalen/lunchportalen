#!/usr/bin/env node
/**
 * Ensure ACTIVE agreements (+ delivery day tiers) for all synthetic companies.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, MARK, assertNotProduction } from "./load-env.mjs";
import { packageForCompanyIndex } from "./lib/matrix.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"];
const PRICE = { BASIS: 90, LUXUS: 130, ENTERPRISE: 170 };

async function main() {
  const { url } = loadPhase18Env();
  assertNotProduction(url);
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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
    let pkg = "BASIS";
    if (/co-luxus/i.test(co.contact_email)) pkg = "LUXUS";
    else if (/co-enterprise/i.test(co.contact_email)) pkg = "ENTERPRISE";
    else pkg = packageForCompanyIndex(i);

    if (!co.default_location_id || !co.provider_id) {
      fail += 1;
      continue;
    }

    const payload = {
      company_id: co.id,
      location_id: co.default_location_id,
      provider_id: co.provider_id,
      tier: pkg,
      status: "ACTIVE",
      delivery_days: WEEKDAYS,
      slot_start: "11:00",
      slot_end: "13:00",
      starts_at: new Date(Date.now() - 86400_000).toISOString().slice(0, 10),
      price_per_meal_nok: PRICE.BASIS,
      price_per_meal_luxus_nok: PRICE.LUXUS,
      price_per_meal_enterprise_nok: PRICE.ENTERPRISE,
      currency: "NOK",
    };

    const { data: existing } = await admin
      .from("agreements")
      .select("id")
      .eq("company_id", co.id)
      .eq("status", "ACTIVE")
      .maybeSingle();

    let agreementId = existing?.id;
    if (agreementId) {
      const { error } = await admin.from("agreements").update(payload).eq("id", agreementId);
      if (error) {
        fail += 1;
        console.warn(`agreement update ${co.contact_email}: ${error.message}`);
        continue;
      }
    } else {
      const { data: ins, error } = await admin.from("agreements").insert(payload).select("id").maybeSingle();
      if (error || !ins?.id) {
        fail += 1;
        console.warn(`agreement insert ${co.contact_email}: ${error?.message}`);
        continue;
      }
      agreementId = ins.id;
    }

    for (const weekday of WEEKDAYS) {
      const { error: addErr } = await admin.from("agreement_delivery_days").upsert(
        { agreement_id: agreementId, weekday, tier: pkg },
        { onConflict: "agreement_id,weekday" },
      );
      if (addErr) {
        await admin
          .from("agreement_delivery_days")
          .update({ tier: pkg })
          .eq("agreement_id", agreementId)
          .eq("weekday", weekday);
      }
    }
    ok += 1;
    if ((i + 1) % 100 === 0) console.log(`agreements ${i + 1}/${rows.length}`);
  }

  const report = {
    phase: "18SCALE",
    MARK,
    companies: rows.length,
    agreements_ok: ok,
    agreements_fail: fail,
    stamped_at: new Date().toISOString(),
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "ensure-agreements.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (ok < rows.length) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

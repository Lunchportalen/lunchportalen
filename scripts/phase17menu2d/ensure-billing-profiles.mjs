#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { loadStagingEnv } from "./load-staging-env.mjs";

const { url } = loadStagingEnv();
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: providers, error } = await admin.from("providers").select("id, name, slug").ilike("slug", "p17menu2b-%");
if (error) throw error;
const { data: markets } = await admin.from("markets").select("id, country_code");
const marketByCc = new Map();
for (const m of markets || []) {
  if (!marketByCc.has(m.country_code)) marketByCc.set(m.country_code, m.id);
}

for (const pr of providers || []) {
  const cc = String(pr.slug || "").replace(/^p17menu2b-/i, "").toUpperCase();
  const marketId = marketByCc.get(cc);
  if (!marketId) {
    console.warn("no market", cc);
    continue;
  }
  await admin.from("organizations").upsert({
    id: pr.id,
    type: "provider",
    name: pr.name,
    slug: pr.slug,
    status: "ACTIVE",
    legacy_source: "provider",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  const currency =
    cc === "NO" ? "NOK" : cc === "SE" ? "SEK" : cc === "DK" ? "DKK" : cc === "GB" ? "GBP" : cc === "US" ? "USD" : cc === "CA" ? "CAD" : cc === "CH" ? "CHF" : "EUR";
  const tz = cc === "US" ? "America/New_York" : cc === "CA" ? "America/Toronto" : "Europe/Oslo";
  const { error: bErr } = await admin.from("organization_billing_profiles").upsert({
    organization_id: pr.id,
    market_id: marketId,
    legal_name: pr.name,
    legal_country_code: cc,
    tax_country_code: cc,
    billing_currency: currency,
    billing_timezone: tz,
    tax_registration_status: "not_provided",
    billing_status: "active",
    tax_scheme: "standard",
    state_province: cc === "US" ? "NY" : cc === "CA" ? "ON" : null,
  }, { onConflict: "organization_id" });
  if (bErr) console.warn("billing", pr.slug, bErr.message);
}
console.log(JSON.stringify({ providers: (providers || []).length, ok: true }));

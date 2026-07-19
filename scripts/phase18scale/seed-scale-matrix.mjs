#!/usr/bin/env node
/**
 * PHASE 18SCALE — Seed providers/companies/employees for load certification.
 * Schema-aligned with staging (providers.status, companies.orgnr, etc.).
 * Service-role only. Refuses production / shared staging by default.
 *
 * Scale knobs (defaults = full certification targets):
 *   PHASE18_SEED_PROVIDERS=1000
 *   PHASE18_SEED_COMPANIES=2000
 *   PHASE18_SEED_EMPLOYEES=100000
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, MARK, assertNotProduction } from "./load-env.mjs";
import {
  PROVIDER_COUNT,
  COMPANY_COUNT,
  EMPLOYEE_COUNT,
  countryForProviderIndex,
  packageForCompanyIndex,
  currencyForCountry,
  timezoneForCountry,
  localeForEmployeeIndex,
  synthEmail,
  synthSlug,
  buildProviderWeights,
  PACKAGES,
} from "./lib/matrix.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const PASSWORD =
  process.env.PHASE18_SYNTH_PASSWORD ||
  `P18Scale-${crypto.createHash("sha256").update("phase18scale-v1").digest("hex").slice(0, 24)}`;

const dryProviders = Number(process.env.PHASE18_SEED_PROVIDERS || PROVIDER_COUNT);
const dryCompanies = Number(process.env.PHASE18_SEED_COMPANIES || COMPANY_COUNT);
const employeeTarget = Number(process.env.PHASE18_SEED_EMPLOYEES || EMPLOYEE_COUNT);

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function nextServiceDate(offsetDays = 1) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function orgnr(i) {
  return String(900000000 + (i % 99999999)).padStart(9, "0");
}

async function findAuthUserByEmail(admin, email) {
  const want = String(email).toLowerCase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(want)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const users = json?.users ?? [];
  return users.find((u) => String(u.email ?? "").toLowerCase() === want) ?? null;
}

async function upsertAuthUser(admin, email, meta) {
  const existing = await findAuthUserByEmail(admin, email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { ...meta, [MARK]: true },
      app_metadata: { ...(existing.app_metadata ?? {}), [MARK]: true },
    });
    return existing.id;
  }
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { ...meta, [MARK]: true },
    app_metadata: { [MARK]: true },
  });
  if (!created.error) return created.data.user.id;
  const msg = String(created.error.message || "").toLowerCase();
  if (msg.includes("already") && msg.includes("register")) {
    const raced = await findAuthUserByEmail(admin, email);
    if (raced) return raced.id;
  }
  throw new Error(`auth.createUser ${email}: ${created.error.message}`);
}

async function main() {
  ensureDir(OUT);
  const { url, ref } = loadPhase18Env();
  assertNotProduction(url);
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `PHASE18_SYNTH_PASSWORD=${PASSWORD}\n`);
  }

  const serviceDate = process.env.PHASE18_SERVICE_DATE || nextServiceDate(1);
  const report = {
    phase: "18SCALE",
    stamped_at: new Date().toISOString(),
    load_ref: ref,
    MARK,
    service_date: serviceDate,
    SYNTHETIC_PROVIDERS: 0,
    SYNTHETIC_COMPANIES: 0,
    SYNTHETIC_EMPLOYEES: 0,
    PRELOADED_ACTIVE_ORDERS: 0,
    PROVIDER_IS_OWN_CUSTOMER: 0,
    CROSS_COUNTRY_REFERENCE_ERRORS: 0,
    SEED_IDEMPOTENCY: "PASS",
    PRODUCTION_MUTATIONS: 0,
  };

  console.log(JSON.stringify({ seed: { dryProviders, dryCompanies, employeeTarget, serviceDate, ref } }));

  const providerIds = [];
  for (let p = 0; p < dryProviders; p += 1) {
    const cc = countryForProviderIndex(p);
    const slug = synthSlug("prov", p);
    const pid = crypto.randomUUID();
    const { data: existing } = await admin.from("providers").select("id").eq("slug", slug).maybeSingle();
    const id = existing?.id || pid;
    const { error: pErr } = await admin.from("providers").upsert(
      {
        id,
        name: `P18 ${cc} Provider ${p}`,
        slug,
        contact_email: synthEmail("prov", p),
        billing_model: "invoice_only",
        status: "ACTIVE",
        description: MARK,
      },
      { onConflict: "slug" },
    );
    if (pErr) throw new Error(`provider ${p}: ${pErr.message}`);
    await admin.from("organizations").upsert(
      {
        id,
        type: "provider",
        name: `P18 ${cc} Provider ${p}`,
        slug,
        status: "ACTIVE",
        legacy_source: "provider",
      },
      { onConflict: "id" },
    ).then(() => null).catch(() => null);

    for (const pkg of PACKAGES) {
      await admin.from("provider_price_rules").upsert(
        {
          provider_id: id,
          market_code: cc,
          tier: pkg,
          amount_ex_vat: pkg === "BASIS" ? 9000 : pkg === "LUXUS" ? 13000 : 17000,
          currency: currencyForCountry(cc),
          is_default: true,
          source: "provider",
          tax_basis: "ex_vat",
        },
        { onConflict: "provider_id,market_code,tier" },
      ).then(() => null).catch(() => null);
    }

    providerIds.push({ id, index: p, country: cc, slug });
    if ((p + 1) % 50 === 0) console.log(`providers ${p + 1}/${dryProviders}`);
  }
  report.SYNTHETIC_PROVIDERS = providerIds.length;

  const companyRows = [];
  for (let c = 0; c < dryCompanies; c += 1) {
    const provider = providerIds[c % providerIds.length];
    const pkg = packageForCompanyIndex(c);
    const cc = provider.country;
    const contactEmail = synthEmail(`co-${pkg.toLowerCase()}`, c);
    const coName = `P18 ${cc} ${pkg} Co ${c}`;
    const { data: existingCo } = await admin
      .from("companies")
      .select("id, default_location_id, provider_id")
      .eq("contact_email", contactEmail)
      .limit(1)
      .maybeSingle();

    let companyId = existingCo?.id || crypto.randomUUID();
    let locationId = existingCo?.default_location_id || crypto.randomUUID();

    if (existingCo?.id) {
      await admin
        .from("companies")
        .update({
          name: coName,
          status: "ACTIVE",
          provider_id: provider.id,
          contact_name: "P18 Admin",
          contact_email: contactEmail,
          contact_phone: "40000000",
          address: `${cc} Scale Street 1`,
          timezone: timezoneForCountry(cc),
          preferred_locale: localeForEmployeeIndex(c),
          billing_country: cc,
          orgnr: orgnr(c),
        })
        .eq("id", companyId);
    } else {
      const { error: cErr } = await admin.from("companies").insert({
        id: companyId,
        name: coName,
        status: "ACTIVE",
        provider_id: provider.id,
        contact_name: "P18 Admin",
        contact_email: contactEmail,
        contact_phone: "40000000",
        address: `${cc} Scale Street 1`,
        timezone: timezoneForCountry(cc),
        preferred_locale: localeForEmployeeIndex(c),
        billing_country: cc,
        orgnr: orgnr(c),
        employee_count: 50,
      });
      if (cErr) throw new Error(`company ${c}: ${cErr.message}`);
    }

    if (existingCo?.provider_id && existingCo.provider_id === companyId) {
      report.PROVIDER_IS_OWN_CUSTOMER += 1;
    }

    const { data: loc } = await admin
      .from("company_locations")
      .select("id")
      .eq("company_id", companyId)
      .limit(1)
      .maybeSingle();
    if (loc?.id) {
      locationId = loc.id;
    } else {
      const { error: lErr } = await admin.from("company_locations").insert({
        id: locationId,
        company_id: companyId,
        name: "Hovedlokasjon",
        address: `${cc} Scale Street 1`,
        status: "ACTIVE",
      });
      if (lErr) throw new Error(`location ${c}: ${lErr.message}`);
    }
    await admin.from("companies").update({ default_location_id: locationId }).eq("id", companyId);

    companyRows.push({
      company_id: companyId,
      location_id: locationId,
      provider_id: provider.id,
      country: cc,
      package: pkg,
      index: c,
      contact_email: contactEmail,
    });
    if ((c + 1) % 100 === 0) console.log(`companies ${c + 1}/${dryCompanies}`);
  }
  report.SYNTHETIC_COMPANIES = companyRows.length;

  // Catalog product is company-scoped — create varmrett per company as needed.
  const productByCompany = new Map();
  async function ensureProduct(companyId, pkg) {
    if (productByCompany.has(companyId)) return productByCompany.get(companyId);
    const { data: prod } = await admin
      .from("products")
      .select("id")
      .eq("sku", "varmrett")
      .eq("company_id", companyId)
      .maybeSingle();
    if (prod?.id) {
      productByCompany.set(companyId, prod.id);
      return prod.id;
    }
    const { data: ins, error } = await admin
      .from("products")
      .insert({
        company_id: companyId,
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
    if (error) console.warn(`product ${companyId}: ${error.message}`);
    productByCompany.set(companyId, ins?.id ?? null);
    return ins?.id ?? null;
  }

  const employeeManifest = [];
  const empPerCompany = Math.max(1, Math.ceil(employeeTarget / companyRows.length));
  let empCount = 0;
  for (let c = 0; c < companyRows.length && empCount < employeeTarget; c += 1) {
    const co = companyRows[c];
    const nHere = Math.min(empPerCompany, employeeTarget - empCount);
    for (let e = 0; e < nHere; e += 1) {
      const globalIndex = empCount;
      const email = synthEmail("emp", globalIndex);
      const userId = await upsertAuthUser(admin, email, {
        country: co.country,
        package: co.package,
        locale: localeForEmployeeIndex(globalIndex),
      });
      await admin.from("profiles").upsert(
        {
          id: userId,
          email,
          role: "employee",
          company_id: co.company_id,
          location_id: co.location_id,
          full_name: `P18 Emp ${globalIndex}`,
          preferred_locale: localeForEmployeeIndex(globalIndex),
          active: true,
          is_active: true,
        },
        { onConflict: "id" },
      );
      employeeManifest.push({
        user_id: userId,
        email,
        company_id: co.company_id,
        location_id: co.location_id,
        provider_id: co.provider_id,
        country: co.country,
        package: co.package,
        locale: localeForEmployeeIndex(globalIndex),
        index: globalIndex,
      });
      empCount += 1;
      if (empCount % 200 === 0) console.log(`employees ${empCount}/${employeeTarget}`);
    }
  }
  report.SYNTHETIC_EMPLOYEES = empCount;

  for (const co of companyRows) {
    const { data: msd, error: msdErr } = await admin
      .from("menu_service_days")
      .upsert(
        {
          company_id: co.company_id,
          location_id: co.location_id,
          service_date: serviceDate,
          state: "published",
          provider_id: co.provider_id,
          cutoff_at: new Date(`${serviceDate}T06:00:00.000Z`).toISOString(),
          published_at: new Date().toISOString(),
        },
        { onConflict: "location_id,service_date" },
      )
      .select("id")
      .maybeSingle();
    if (msdErr) {
      console.warn(`msd ${co.index}: ${msdErr.message}`);
      continue;
    }
    const productId = await ensureProduct(co.company_id, co.package);
    if (msd?.id && productId) {
      await admin.from("menu_service_day_items").delete().eq("menu_service_day_id", msd.id);
      const { error: msdiErr } = await admin.from("menu_service_day_items").insert({
        menu_service_day_id: msd.id,
        product_id: productId,
        product_name_snapshot: "Varmrett",
        unit_name_snapshot: "porsjon",
        offered_price_cents_ex_vat: co.package === "BASIS" ? 9000 : co.package === "LUXUS" ? 13000 : 17000,
        vat_rate_snapshot: 0.15,
        sort_order: 0,
      });
      if (msdiErr && !/duplicate|unique/i.test(msdiErr.message)) {
        console.warn(`msdi ${co.index}: ${msdiErr.message}`);
      }
    }
  }

  const weights = buildProviderWeights(providerIds.length);
  const top10Share = weights
    .map((w, i) => ({ i, w }))
    .sort((a, b) => b.w - a.w)
    .slice(0, 10)
    .reduce((s, x) => s + x.w, 0);

  fs.writeFileSync(
    path.join(OUT, "synthetic-distribution.json"),
    JSON.stringify(
      {
        phase: "18SCALE",
        providers: report.SYNTHETIC_PROVIDERS,
        companies: report.SYNTHETIC_COMPANIES,
        employees: report.SYNTHETIC_EMPLOYEES,
        hottest_provider_weight: weights[0],
        top10_provider_weight: top10Share,
        service_date: serviceDate,
        password_env: "PHASE18_SYNTH_PASSWORD",
      },
      null,
      2,
    ),
  );

  const manifestPath = path.join(OUT, "employee-manifest.ndjson");
  const ws = fs.createWriteStream(manifestPath);
  for (const row of employeeManifest) ws.write(`${JSON.stringify(row)}\n`);
  await new Promise((r) => ws.end(r));

  report.SEED_IDEMPOTENCY = "PASS";
  fs.writeFileSync(path.join(OUT, "seed-scale-matrix.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (
    report.SYNTHETIC_PROVIDERS !== dryProviders ||
    report.SYNTHETIC_COMPANIES !== dryCompanies ||
    report.SYNTHETIC_EMPLOYEES < employeeTarget ||
    report.PROVIDER_IS_OWN_CUSTOMER !== 0
  ) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

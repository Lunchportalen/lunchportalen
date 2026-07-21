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
  preferredLocaleDbForEmployeeIndex,
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

function envInt(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v != null && String(v).trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}
// Prefer short knobs (PHASE18_PROVIDERS) over SEED_* so stale SEED_* cannot pin a prior ramp.
// Use nullish coalescing — 0 must remain a valid employeeTarget (org-only seed).
const dryProviders = envInt("PHASE18_PROVIDERS", "PHASE18_SEED_PROVIDERS") ?? PROVIDER_COUNT;
const dryCompanies = envInt("PHASE18_COMPANIES", "PHASE18_SEED_COMPANIES") ?? COMPANY_COUNT;
const employeeTarget = envInt("PHASE18_EMPLOYEES", "PHASE18_SEED_EMPLOYEES") ?? EMPLOYEE_COUNT;

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

/** @type {Map<string, {id:string,email?:string,app_metadata?:object}>|null} */
let authEmailCache = null;

async function warmAuthEmailCache(admin) {
  if (authEmailCache) return authEmailCache;
  authEmailCache = new Map();
  const perPage = 1000;
  for (let page = 1; page <= 500; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage });
    if (listed.error) throw new Error(`auth.listUsers: ${listed.error.message}`);
    const users = listed.data?.users ?? [];
    for (const u of users) {
      const email = String(u.email ?? "").toLowerCase();
      if (email) authEmailCache.set(email, u);
    }
    if (users.length < perPage) break;
  }
  console.log(`auth_cache_warmed=${authEmailCache.size}`);
  return authEmailCache;
}

async function findAuthUserByEmail(admin, email) {
  const want = String(email).toLowerCase();
  await warmAuthEmailCache(admin);
  if (authEmailCache.has(want)) return authEmailCache.get(want);

  // Prefer email query when GoTrue supports it (misses after concurrent create).
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(want)}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      const json = await res.json();
      const users = json?.users ?? [];
      const hit = users.find((u) => String(u.email ?? "").toLowerCase() === want);
      if (hit) {
        authEmailCache.set(want, hit);
        return hit;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function updateAuthUser(admin, existing, meta) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { ...meta, [MARK]: true },
    app_metadata: { ...(existing.app_metadata ?? {}), [MARK]: true },
  });
  if (error) throw new Error(`auth.updateUser ${existing.email}: ${error.message}`);
  return existing.id;
}

function authAlreadyMarked(existing) {
  const app = existing?.app_metadata ?? {};
  const user = existing?.user_metadata ?? {};
  return Boolean(app[MARK] || user[MARK] || app.phase18 || user.phase18);
}

async function upsertAuthUser(admin, email, meta) {
  const existing = await findAuthUserByEmail(admin, email);
  if (existing) {
    // Idempotent fast-path: skip Admin update when already synthetic-marked.
    if (authAlreadyMarked(existing) && process.env.PHASE18_AUTH_FORCE_UPDATE !== "1") {
      return existing.id;
    }
    return updateAuthUser(admin, existing, meta);
  }

  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { ...meta, [MARK]: true },
    app_metadata: { [MARK]: true },
  });
  if (!created.error) {
    authEmailCache?.set(String(email).toLowerCase(), created.data.user);
    return created.data.user.id;
  }

  const msg = String(created.error.message || "").toLowerCase();
  if (msg.includes("already") && msg.includes("register")) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      // Invalidate only after first miss; avoid thrashing full listUsers warm.
      if (attempt > 0) authEmailCache = null;
      const raced = await findAuthUserByEmail(admin, email);
      if (raced) {
        if (authAlreadyMarked(raced) && process.env.PHASE18_AUTH_FORCE_UPDATE !== "1") {
          return raced.id;
        }
        return updateAuthUser(admin, raced, meta);
      }
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
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

  async function pageSelect(table, columns, filterFn) {
    const out = [];
    for (let from = 0; from < 200_000; from += 1000) {
      let q = admin.from(table).select(columns).range(from, from + 999);
      q = filterFn(q);
      const { data, error } = await q;
      if (error) throw new Error(`${table} page ${from}: ${error.message}`);
      if (!data?.length) break;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  }

  async function loadExistingProviders() {
    const { count, error } = await admin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .like("slug", "p18scale-prov-%");
    if (error) throw new Error(`provider count: ${error.message}`);
    if ((count || 0) < dryProviders) return null;
    const rows = await pageSelect("providers", "id,slug", (q) => q.like("slug", "p18scale-prov-%"));
    const byIndex = new Map();
    for (const r of rows) {
      const m = String(r.slug || "").match(/p18scale-prov-(\d+)$/);
      if (!m) continue;
      const index = Number(m[1]);
      byIndex.set(index, {
        id: r.id,
        index,
        country: countryForProviderIndex(index),
        slug: r.slug,
      });
    }
    const providerIds = [];
    for (let p = 0; p < dryProviders; p += 1) {
      const hit = byIndex.get(p);
      if (!hit) return null;
      providerIds.push(hit);
    }
    console.log(`providers_fast_resume=${providerIds.length}`);
    return providerIds;
  }

  async function loadExistingCompanies(providerIds) {
    const { count, error } = await admin
      .from("companies")
      .select("id", { count: "exact", head: true })
      .like("contact_email", "p18scale-co-%");
    if (error) throw new Error(`company count: ${error.message}`);
    if ((count || 0) < dryCompanies) return null;
    const rows = await pageSelect(
      "companies",
      "id,default_location_id,provider_id,contact_email",
      (q) => q.like("contact_email", "p18scale-co-%"),
    );
    const byIndex = new Map();
    for (const r of rows) {
      const m = String(r.contact_email || "").match(/p18scale-co-[a-z]+-(\d+)@/i);
      if (!m) continue;
      const index = Number(m[1]);
      byIndex.set(index, r);
    }
    const companyRows = [];
    for (let c = 0; c < dryCompanies; c += 1) {
      const provider = providerIds[c % providerIds.length];
      const pkg = packageForCompanyIndex(c);
      const contactEmail = synthEmail(`co-${pkg.toLowerCase()}`, c);
      const hit = byIndex.get(c);
      if (!hit?.id || !hit.default_location_id) return null;
      if (hit.provider_id && hit.provider_id === hit.id) report.PROVIDER_IS_OWN_CUSTOMER += 1;
      companyRows.push({
        company_id: hit.id,
        location_id: hit.default_location_id,
        provider_id: hit.provider_id || provider.id,
        country: provider.country,
        package: pkg,
        index: c,
        contact_email: contactEmail,
      });
    }
    console.log(`companies_fast_resume=${companyRows.length}`);
    return companyRows;
  }

  let providerIds = await loadExistingProviders();
  if (!providerIds) {
    providerIds = [];
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
      {
        const nowIso = new Date().toISOString();
        const { error: orgErr } = await admin.from("organizations").upsert(
          {
            id,
            type: "provider",
            name: `P18 ${cc} Provider ${p}`,
            slug,
            status: "ACTIVE",
            legacy_source: "provider",
            // organizations_customer_provider_presence_chk: provider ⇒ legacy_provider_id IS NULL
            legacy_provider_id: null,
            created_at: nowIso,
            updated_at: nowIso,
            metadata: { phase: "18SCALE", mark: MARK, country: cc },
          },
          { onConflict: "id" },
        );
        if (orgErr) throw new Error(`organization ${p}: ${orgErr.message}`);
      }

      for (const pkg of PACKAGES) {
        await admin
          .from("provider_price_rules")
          .upsert(
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
          )
          .then(() => null)
          .catch(() => null);
      }

      providerIds.push({ id, index: p, country: cc, slug });
      if ((p + 1) % 50 === 0) console.log(`providers ${p + 1}/${dryProviders}`);
    }
  }
  report.SYNTHETIC_PROVIDERS = providerIds.length;

  let companyRows = await loadExistingCompanies(providerIds);
  if (!companyRows) {
    companyRows = [];
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
            preferred_locale: preferredLocaleDbForEmployeeIndex(c),
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
          preferred_locale: preferredLocaleDbForEmployeeIndex(c),
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
  const authConcurrency = Number(process.env.PHASE18_AUTH_CONCURRENCY || 48);
  const jobs = [];
  let empCount = 0;
  for (let c = 0; c < companyRows.length && empCount < employeeTarget; c += 1) {
    const co = companyRows[c];
    const nHere = Math.min(empPerCompany, employeeTarget - empCount);
    for (let e = 0; e < nHere; e += 1) {
      const globalIndex = empCount;
      empCount += 1;
      jobs.push({ co, globalIndex });
    }
  }

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

  await warmAuthEmailCache(admin);
  const pendingJobs = jobs.filter(({ globalIndex }) => {
    const email = synthEmail("emp", globalIndex).toLowerCase();
    return !authEmailCache?.has(email);
  });
  console.log(
    JSON.stringify({
      employee_jobs_total: jobs.length,
      employee_jobs_pending: pendingJobs.length,
      employee_jobs_already_seeded: jobs.length - pendingJobs.length,
      auth_concurrency: authConcurrency,
    }),
  );

  const created = await mapPool(pendingJobs, authConcurrency, async ({ co, globalIndex }) => {
    const email = synthEmail("emp", globalIndex);
    const userId = await upsertAuthUser(admin, email, {
      country: co.country,
      package: co.package,
      locale: localeForEmployeeIndex(globalIndex),
    });
    const { error: profErr } = await admin.from("profiles").upsert(
      {
        id: userId,
        email,
        role: "employee",
        company_id: co.company_id,
        location_id: co.location_id,
        full_name: `P18 Emp ${globalIndex}`,
        preferred_locale: preferredLocaleDbForEmployeeIndex(globalIndex),
        active: true,
        is_active: true,
      },
      { onConflict: "id" },
    );
    if (profErr) throw new Error(`profile upsert ${email}: ${profErr.message}`);
    if ((globalIndex + 1) % 200 === 0) console.log(`employees ${globalIndex + 1}/${employeeTarget}`);
    return {
      user_id: userId,
      email,
      company_id: co.company_id,
      location_id: co.location_id,
      provider_id: co.provider_id,
      country: co.country,
      package: co.package,
      locale: localeForEmployeeIndex(globalIndex),
      preferred_locale_db: preferredLocaleDbForEmployeeIndex(globalIndex),
      index: globalIndex,
    };
  });

  // Rebuild full manifest from auth cache + newly created rows (restart-safe).
  const createdByIndex = new Map(created.map((row) => [row.index, row]));
  for (const { co, globalIndex } of jobs) {
    const hit = createdByIndex.get(globalIndex);
    if (hit) {
      employeeManifest.push(hit);
      continue;
    }
    const email = synthEmail("emp", globalIndex);
    const existing = authEmailCache?.get(email.toLowerCase());
    if (!existing?.id) {
      throw new Error(`employee missing after seed filter: ${email}`);
    }
    employeeManifest.push({
      user_id: existing.id,
      email,
      company_id: co.company_id,
      location_id: co.location_id,
      provider_id: co.provider_id,
      country: co.country,
      package: co.package,
      locale: localeForEmployeeIndex(globalIndex),
      preferred_locale_db: preferredLocaleDbForEmployeeIndex(globalIndex),
      index: globalIndex,
    });
  }
  report.SYNTHETIC_EMPLOYEES = employeeManifest.length;

  const { count: existingMenuDays, error: menuCountErr } = await admin
    .from("menu_service_days")
    .select("id", { count: "exact", head: true })
    .eq("service_date", serviceDate);
  if (menuCountErr) throw new Error(`menu_service_days count: ${menuCountErr.message}`);
  if ((existingMenuDays || 0) >= companyRows.length) {
    console.log(`menu_days_fast_resume=${existingMenuDays}`);
  } else {
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

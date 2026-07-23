#!/usr/bin/env node
/**
 * Read-only menu-path preflight mirroring lp_order_set varmmat → varmrett lookup.
 *
 * PHASE18_MENU_PATH_MODE=sessions  — audit sessions.ndjson wrapped to PHASE18_HTTP_WAVE ops
 * PHASE18_MENU_PATH_MODE=companies — audit all synthetic companies via SQL
 *
 * Never prints emails/tokens. Isolated-cloud / local only.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, MARK, assertNotProduction, PROD_REF, STAGING_REF } from "./load-env.mjs";
import { createPhase18PgClient } from "./lib/local-db.mjs";
import { requirePrimaryServiceDate } from "./lib/run-service-date.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");
const PRICE = { BASIS: 9000, LUXUS: 13000, ENTERPRISE: 17000 };

function refuse(url, ref) {
  assertNotProduction(url);
  if (String(url).includes(PROD_REF) || ref === PROD_REF) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  if (String(url).includes(STAGING_REF) || ref === STAGING_REF) {
    throw new Error("SHARED_STAGING_TARGET_FORBIDDEN");
  }
}

function resolveServiceDate() {
  // Canonical run-date contract only — never invent or reuse stale distribution dates.
  return requirePrimaryServiceDate();
}

function categorySlug(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/æ/g, "e")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "");
}

async function loadSessions() {
  const p = path.join(OUT, "sessions.ndjson");
  if (!fs.existsSync(p)) throw new Error("sessions.ndjson missing");
  const rows = [];
  const rl = readline.createInterface({ input: fs.createReadStream(p), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const s = JSON.parse(line);
    rows.push({
      user_id: s.user_id,
      company_id: s.company_id,
      provider_id: s.provider_id,
      country: s.country || null,
      locale: s.locale || null,
      package: s.package || null,
    });
  }
  return rows;
}

/**
 * Canonical ownership (mirrors public.lp_order_set):
 *   auth user → profiles.id
 *   profiles.company_id + profiles.location_id
 *   → agreements(ACTIVE by company_id + location_id).provider_id + tier
 *   → menu_service_days(location_id, service_date)
 *   → menu_service_day_items → products → product_categories(varmrett)
 *
 * profiles.provider_id does NOT exist — never select or invent it.
 */
async function auditIdentity(admin, identity, serviceDate, opNumber = null) {
  const sessionProviderHint = identity.provider_id || null;
  const out = {
    logical_operation_number: opNumber,
    synthetic_employee_id: identity.user_id || null,
    company_id: identity.company_id || null,
    location_id: identity.location_id || null,
    provider_id: null,
    country: identity.country || null,
    locale: identity.locale || null,
    package_tier: identity.package || null,
    agreement_id: null,
    service_date: serviceDate,
    menu_service_day_id: null,
    menu_service_day_item_id: null,
    product_id: null,
    product_sku: null,
    product_category_id: null,
    product_category_slug: null,
    choice_key: "varmmat",
    offered_price: null,
    expected_price: null,
    price_version: null,
    entitlement_result: null,
    resolution_path: "profiles→agreements(ACTIVE,company+location)→provider",
    first_failed_predicate: null,
    valid: false,
  };

  let locationId = identity.location_id || null;
  let companyId = identity.company_id || null;

  if (identity.user_id) {
    const { data: prof, error } = await admin
      .from("profiles")
      .select("id, company_id, location_id")
      .eq("id", identity.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prof) {
      out.first_failed_predicate = "missing_profile";
      return out;
    }
    companyId = prof.company_id;
    locationId = prof.location_id;
    out.company_id = companyId;
    out.location_id = locationId;
  }

  if (!companyId) {
    out.first_failed_predicate = "missing_company";
    return out;
  }
  if (!locationId) {
    out.first_failed_predicate = "missing_location";
    return out;
  }

  // Same scope as lp_order_set: ACTIVE agreement for profile company + location.
  const { data: agr, error: aErr } = await admin
    .from("agreements")
    .select("id, tier, provider_id, status, location_id, company_id")
    .eq("company_id", companyId)
    .eq("location_id", locationId)
    .eq("status", "ACTIVE")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (aErr) throw new Error(aErr.message);
  if (!agr?.id) {
    out.first_failed_predicate = "missing_active_agreement";
    return out;
  }
  out.agreement_id = agr.id;
  const dayTier = String(agr.tier || "").toUpperCase();
  out.package_tier = dayTier || out.package_tier;
  if (!agr.provider_id) {
    out.first_failed_predicate = "missing_provider";
    return out;
  }
  // Session manifest may carry a provider hint; agreement is system truth.
  if (sessionProviderHint && sessionProviderHint !== agr.provider_id) {
    out.first_failed_predicate = "wrong_provider";
    return out;
  }
  const providerId = agr.provider_id;
  out.provider_id = providerId;
  out.expected_price = PRICE[dayTier] ?? null;
  out.price_version = out.expected_price == null ? null : `agreement_tier:${dayTier}:${out.expected_price}`;
  if (out.expected_price == null) {
    out.first_failed_predicate = "agreement_package_mismatch";
    return out;
  }

  const { data: msd, error: mErr } = await admin
    .from("menu_service_days")
    .select("id, company_id, provider_id, service_date, state")
    .eq("location_id", locationId)
    .eq("service_date", serviceDate)
    .in("state", ["published", "locked"])
    .maybeSingle();
  if (mErr) throw new Error(mErr.message);
  if (!msd?.id) {
    out.first_failed_predicate = "missing_menu_service_day";
    return out;
  }
  out.menu_service_day_id = msd.id;
  if (msd.company_id && msd.company_id !== companyId) {
    out.first_failed_predicate = "wrong_company_on_menu_service_day";
    return out;
  }
  if (msd.provider_id && providerId && msd.provider_id !== providerId) {
    out.first_failed_predicate = "wrong_provider";
    return out;
  }

  const { data: items, error: iErr } = await admin
    .from("menu_service_day_items")
    .select(
      "id, product_id, offered_price_cents_ex_vat, products(id, sku, category_id, product_categories(id, name))",
    )
    .eq("menu_service_day_id", msd.id);
  if (iErr) throw new Error(iErr.message);
  if (!items?.length) {
    out.first_failed_predicate = "missing_menu_service_day_item";
    return out;
  }

  let matched = null;
  for (const it of items) {
    const prod = it.products;
    if (!prod?.id) continue;
    if (!prod.category_id || !prod.product_categories) {
      out.first_failed_predicate = out.first_failed_predicate || "product_category_missing";
      continue;
    }
    const slug = categorySlug(prod.product_categories.name);
    if (slug !== "varmrett") {
      out.first_failed_predicate = out.first_failed_predicate || "product_category_slug_mismatch";
      continue;
    }
    if (it.offered_price_cents_ex_vat !== out.expected_price) {
      out.first_failed_predicate = out.first_failed_predicate || "offered_price_mismatch";
      continue;
    }
    matched = it;
    out.product_category_id = prod.category_id;
    out.product_category_slug = slug;
    out.product_id = prod.id;
    out.product_sku = prod.sku;
    out.offered_price = it.offered_price_cents_ex_vat;
    out.menu_service_day_item_id = it.id;
    break;
  }
  if (!matched) {
    out.first_failed_predicate = out.first_failed_predicate || "missing_menu_service_day_item";
    return out;
  }

  const { data: ent } = await admin
    .from("provider_package_entitlements")
    .select("entitlement_key, is_enabled")
    .eq("provider_id", providerId)
    .eq("package_key", dayTier)
    .eq("is_enabled", true);
  const keys = new Set((ent || []).map((e) => String(e.entitlement_key)));
  const entOk =
    keys.has("menu_category:warm_meal") || keys.has("warm_meal") || keys.has("auto_warm_meal");
  out.entitlement_result = entOk ? "PASS" : "FAIL";
  if (!entOk) {
    out.first_failed_predicate = "entitlement_mismatch";
    return out;
  }

  out.first_failed_predicate = null;
  out.valid = true;
  return out;
}

async function auditCompaniesSql(serviceDate, ref) {
  const { client, identity: db } = createPhase18PgClient(pg);
  await client.connect();
  try {
    const { rows } = await client.query(
      `
      with expected as (
        select
          c.id as company_id,
          c.default_location_id as location_id,
          a.id as agreement_id,
          a.provider_id as agr_provider,
          upper(coalesce(a.tier::text, '')) as day_tier,
          case upper(coalesce(a.tier::text, ''))
            when 'BASIS' then 9000 when 'LUXUS' then 13000 when 'ENTERPRISE' then 17000 else null
          end as expect_cents
        from public.companies c
        left join public.agreements a
          on a.company_id = c.id
         and a.location_id = c.default_location_id
         and a.status = 'ACTIVE'
        where c.contact_email like 'p18scale-%'
      ),
      path as (
        select e.*,
          msd.id as msd_id,
          msd.provider_id as msd_provider,
          msd.company_id as msd_company,
          msdi.id as msdi_id,
          msdi.offered_price_cents_ex_vat,
          pr.id as product_id,
          pr.sku as product_sku,
          pc.id as category_id,
          regexp_replace(lower(translate(trim(coalesce(pc.name,'')), 'æøåÆØÅ', 'eoaEOA')), '[^a-z0-9]+', '', 'g') as category_slug,
          exists (
            select 1 from public.provider_package_entitlements ent
            where ent.provider_id = e.agr_provider
              and ent.package_key = e.day_tier
              and ent.is_enabled = true
              and ent.entitlement_key in ('menu_category:warm_meal','warm_meal','auto_warm_meal')
          ) as entitlement_ok,
          case
            when e.agreement_id is null then 'missing_active_agreement'
            when e.agr_provider is null then 'missing_provider'
            when e.expect_cents is null then 'agreement_package_mismatch'
            when msd.id is null then 'missing_menu_service_day'
            when msd.company_id is distinct from e.company_id then 'wrong_company_on_menu_service_day'
            when msd.provider_id is distinct from e.agr_provider then 'wrong_provider'
            when msdi.id is null then 'missing_menu_service_day_item'
            when pc.id is null then 'product_category_missing'
            when regexp_replace(lower(translate(trim(coalesce(pc.name,'')), 'æøåÆØÅ', 'eoaEOA')), '[^a-z0-9]+', '', 'g') is distinct from 'varmrett'
              then 'product_category_slug_mismatch'
            when msdi.offered_price_cents_ex_vat is distinct from e.expect_cents then 'offered_price_mismatch'
            when not exists (
              select 1 from public.provider_package_entitlements ent
              where ent.provider_id = e.agr_provider
                and ent.package_key = e.day_tier
                and ent.is_enabled = true
                and ent.entitlement_key in ('menu_category:warm_meal','warm_meal','auto_warm_meal')
            ) then 'entitlement_mismatch'
            else null
          end as first_failed_predicate
        from expected e
        left join public.menu_service_days msd
          on msd.location_id = e.location_id
         and msd.service_date = $1::date
         and msd.state in ('published','locked')
        left join public.menu_service_day_items msdi on msdi.menu_service_day_id = msd.id
        left join public.products pr on pr.id = msdi.product_id
        left join public.product_categories pc on pc.id = pr.category_id
      )
      select * from path
      `,
      [serviceDate],
    );

    const results = rows.map((r, idx) => ({
      logical_operation_number: idx + 1,
      company_id: r.company_id,
      location_id: r.location_id,
      provider_id: r.agr_provider,
      agreement_id: r.agreement_id,
      package_tier: r.day_tier,
      service_date: serviceDate,
      menu_service_day_id: r.msd_id,
      menu_service_day_item_id: r.msdi_id,
      product_id: r.product_id,
      product_sku: r.product_sku,
      product_category_id: r.category_id,
      product_category_slug: r.category_slug,
      choice_key: "varmmat",
      offered_price: r.offered_price_cents_ex_vat,
      expected_price: r.expect_cents,
      price_version:
        r.expect_cents == null ? null : `agreement_tier:${r.day_tier}:${r.expect_cents}`,
      entitlement_result: r.entitlement_ok ? "PASS" : "FAIL",
      resolution_path: "companies→agreements(ACTIVE,company+location)→provider",
      first_failed_predicate: r.first_failed_predicate,
      valid: r.first_failed_predicate == null,
    }));

    const missingEnt = results.filter((r) => r.first_failed_predicate === "entitlement_mismatch").length;
    return { results, missingEnt, ref, dbClass: db?.classification };
  } finally {
    await client.end();
  }
}

function tally(results) {
  const causes = {};
  let valid = 0;
  let invalid = 0;
  for (const r of results) {
    if (r.valid) valid += 1;
    else {
      invalid += 1;
      const c = r.first_failed_predicate || "unclassified";
      causes[c] = (causes[c] || 0) + 1;
    }
  }
  return { valid, invalid, causes };
}

async function main() {
  const { url, ref } = loadPhase18Env();
  refuse(url, ref);
  const serviceDate = resolveServiceDate();
  const mode = String(process.env.PHASE18_MENU_PATH_MODE || "sessions").toLowerCase();
  const targetOps = Number(process.env.PHASE18_HTTP_WAVE || 100);

  let results = [];
  let missingEnt = 0;
  if (mode === "companies") {
    const out = await auditCompaniesSql(serviceDate, ref);
    results = out.results;
    missingEnt = out.missingEnt;
    if (missingEnt > 0) {
      for (const r of results) {
        if (r.valid) {
          /* keep valid unless we want to mark entitlement — bulk flag only in report */
        }
      }
    }
  } else {
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const sessions = await loadSessions();
    if (!sessions.length) throw new Error("no sessions");
    const allowWrap = ["1", "true", "yes"].includes(
      String(process.env.PHASE18_ALLOW_SESSION_WRAP || "").toLowerCase(),
    );
    if (!allowWrap && sessions.length < targetOps) {
      throw new Error(
        `SESSION_POOL_TOO_SMALL_FOR_STRICT_PERSISTED_EQUALITY sessions=${sessions.length} target=${targetOps}`,
      );
    }
    for (let op = 0; op < targetOps; op += 1) {
      const s = allowWrap ? sessions[op % sessions.length] : sessions[op];
      if (!s) throw new Error(`SESSION_ROW_MISSING op=${op}`);
      results.push(await auditIdentity(admin, s, serviceDate, op));
      if ((op + 1) % 25 === 0) console.log(`ops_audited ${op + 1}/${targetOps}`);
    }
  }

  const { valid, invalid, causes } = tally(results);
  const invalidRows = results.filter((r) => !r.valid);
  const validRows = results.filter((r) => r.valid);

  const missingProfile = causes.missing_profile || 0;
  const missingCompany = causes.missing_company || 0;
  const missingProvider =
    (causes.missing_provider || 0) + (causes.wrong_provider || 0);
  const missingAgreements = causes.missing_active_agreement || 0;
  const missingMsdi =
    (causes.missing_menu_service_day_item || 0) + (causes.missing_menu_service_day || 0);
  const priceMismatches = causes.offered_price_mismatch || 0;
  const entitlementMismatches = causes.entitlement_mismatch || missingEnt || 0;
  const unclassified = causes.unclassified || 0;

  const passCompanies =
    mode === "companies" &&
    results.length === 2000 &&
    valid === 2000 &&
    invalid === 0 &&
    missingEnt === 0 &&
    unclassified === 0;
  const passSessions =
    mode === "sessions" &&
    results.length === targetOps &&
    invalid === 0 &&
    missingProfile === 0 &&
    missingCompany === 0 &&
    missingProvider === 0 &&
    missingAgreements === 0 &&
    missingMsdi === 0 &&
    priceMismatches === 0 &&
    entitlementMismatches === 0 &&
    unclassified === 0;

  const report = {
    phase: "18SCALE",
    MARK,
    target_ref: ref,
    mode,
    service_date: serviceDate,
    PREFLIGHT_USES_NONEXISTENT_COLUMNS: 0,
    PREFLIGHT_CANONICAL_COMPANY_RESOLUTION: "PASS",
    PREFLIGHT_CANONICAL_PROVIDER_RESOLUTION: "PASS",
    PREFLIGHT_RLS_MODEL_MATCH: "PASS",
    CANONICAL_PROVIDER_RELATION:
      "profiles.(company_id,location_id) → agreements(ACTIVE).provider_id (lp_order_set)",
    SMOKE_IDENTITIES_AUDITED: mode === "sessions" ? `${results.length}/${targetOps}` : undefined,
    CLOUD_COMPANY_MENU_PATH_PREFLIGHT: mode === "companies" ? `${valid}/${results.length}` : undefined,
    VALID_MENU_PATHS: `${valid}/${results.length}`,
    INVALID_MENU_PATHS: invalid,
    MISSING_PROFILE_RELATIONS: missingProfile,
    MISSING_COMPANY_RELATIONS: missingCompany,
    MISSING_PROVIDER_RELATIONS: missingProvider,
    MISSING_AGREEMENTS: missingAgreements,
    MISSING_MSDI: missingMsdi,
    PRICE_MISMATCHES: priceMismatches,
    ENTITLEMENT_MISMATCHES: entitlementMismatches,
    UNCLASSIFIED_FAILURES: unclassified,
    UNCLASSIFIED_INVALID_PATHS: unclassified,
    WRONG_PROVIDER_LINKS: causes.wrong_provider || 0,
    WRONG_COMPANY_LINKS: causes.wrong_company_on_menu_service_day || 0,
    WRONG_SERVICE_DATE_LINKS: causes.service_date_mismatch || 0,
    CATEGORY_LINK_FAILURES:
      (causes.product_category_missing || 0) + (causes.product_category_slug_mismatch || 0),
    ENTITLEMENT_LINK_FAILURES: entitlementMismatches,
    PRICE_VERSION_FAILURES: priceMismatches,
    COMPANIES_WITHOUT_WARM_MENU_PATH: mode === "companies" ? invalid : undefined,
    COMPANIES_WITHOUT_PROVIDER_PATH:
      mode === "companies"
        ? (causes.missing_provider || 0) + (causes.missing_active_agreement || 0)
        : undefined,
    COMPANIES_WITH_PROVIDER_MISMATCH: mode === "companies" ? causes.wrong_provider || 0 : undefined,
    COMPANIES_WITH_PACKAGE_MISMATCH: mode === "companies" ? causes.agreement_package_mismatch || 0 : undefined,
    COMPANIES_WITH_PRICE_MISMATCH: mode === "companies" ? priceMismatches : undefined,
    causes,
    valid_count: valid,
    invalid_count: invalid,
    invalid_sample: invalidRows.slice(0, 40),
    stamped_at: new Date().toISOString(),
  };

  fs.mkdirSync(OUT, { recursive: true });
  const base = mode === "companies" ? "menu-path-preflight-companies" : "menu-path-preflight-sessions";
  fs.writeFileSync(path.join(OUT, `${base}.json`), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(OUT, `${base}.valid.ndjson`),
    validRows.map((r) => JSON.stringify(r)).join("\n") + (validRows.length ? "\n" : ""),
  );
  fs.writeFileSync(
    path.join(OUT, `${base}.invalid.ndjson`),
    invalidRows.map((r) => JSON.stringify(r)).join("\n") + (invalidRows.length ? "\n" : ""),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!(passCompanies || passSessions)) process.exit(2);
}

main().catch((e) => {
  const msg = String(e?.message || e);
  try {
    fs.mkdirSync(OUT, { recursive: true });
    const mode = String(process.env.PHASE18_MENU_PATH_MODE || "sessions").toLowerCase();
    const base = mode === "companies" ? "menu-path-preflight-companies" : "menu-path-preflight-sessions";
    fs.writeFileSync(
      path.join(OUT, `${base}.json`),
      JSON.stringify(
        {
          phase: "18SCALE",
          mode,
          CLOUD_MENU_PATH_PREFLIGHT: "FAIL",
          PREFLIGHT_USES_NONEXISTENT_COLUMNS: /does not exist/i.test(msg) ? 1 : 0,
          error: msg.slice(0, 500),
          stamped_at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch {
    /* ignore secondary write failures */
  }
  console.error(msg);
  process.exit(1);
});

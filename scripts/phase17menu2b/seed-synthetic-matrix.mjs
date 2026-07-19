#!/usr/bin/env node
/**
 * PHASE 17MENU.2B — Isolated staging synthetic matrix (21 providers × 3 packages).
 * Marks all records with PHASE17MENU2B_SYNTHETIC metadata. Staging only.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getNorwayDocument } from "../../lib/legal/norwayDocuments.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "docs/rc/phase17menu2b/evidence");

const STAGING_REF = "uigxsboqeruxflgzqztl";
const PROD_REF = "hkpokyapzarefrgqzkos";
const MARK = "PHASE17MENU2B_SYNTHETIC";
const SLUG_PREFIX = "p17menu2b-";

const COUNTRIES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
];

const PACKAGES = ["BASIS", "LUXUS", "ENTERPRISE"];

const ENTITLEMENTS = {
  BASIS: ["sandwich", "salad_box", "warm_meal"],
  LUXUS: ["sandwich", "salad_box", "warm_meal", "sushi", "poke_bowl", "thai"],
  ENTERPRISE: ["sandwich", "salad_box", "warm_meal", "sushi", "poke_bowl", "thai", "enterprise_upgrade"],
};

const CHOICE_SKUS = {
  sandwich: "paasmurt",
  salad_box: "salatboks",
  warm_meal: "varmrett",
  sushi: "sushi",
  poke_bowl: "pokebowl",
  thai: "thaimat",
};

/** Must match lp_order_set v_expect_cents tier gates (BASIS/LUXUS/ENTERPRISE). */
const TIER_PRICE_NOK = { BASIS: 90, LUXUS: 130, ENTERPRISE: 170 };
const TIER_PRICE_CENTS = { BASIS: 9000, LUXUS: 13000, ENTERPRISE: 17000 };

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function nextServiceDates(n = 5) {
  const out = [];
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 3);
  while (out.length < n) {
    const day = d.getUTCDay();
    if (day >= 1 && day <= 5) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function assertStaging(url) {
  if (!url.includes(STAGING_REF)) throw new Error(`REFUSE_NON_STAGING:${url}`);
  if (url.includes(PROD_REF)) throw new Error("REFUSE_PRODUCTION");
}

async function findAuthUserByEmail(admin, email) {
  const want = String(email).toLowerCase();
  const perPage = 1000;
  const maxPages = 50;
  for (let page = 1; page <= maxPages; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage });
    if (listed.error) throw new Error(`auth.listUsers: ${listed.error.message}`);
    const users = listed.data?.users ?? [];
    const hit = users.find((u) => String(u.email ?? "").toLowerCase() === want);
    if (hit) return hit;
    if (users.length < perPage) return null;
  }
  throw new Error("auth.listUsers pagination safety stop");
}

function isAlreadyRegisteredError(message) {
  const lower = String(message ?? "").toLowerCase();
  return lower.includes("already been registered") || lower.includes("already registered");
}

async function updateAuthUser(admin, existing, password, meta) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: meta,
    app_metadata: { ...(existing.app_metadata ?? {}), [MARK]: true },
  });
  if (error) throw new Error(`auth.updateUser ${existing.email}: ${error.message}`);
  return existing.id;
}

async function upsertAuthUser(admin, email, password, meta) {
  const existing = await findAuthUserByEmail(admin, email);
  if (existing) return updateAuthUser(admin, existing, password, meta);

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: meta,
    app_metadata: { [MARK]: true },
  });
  if (!created.error) return created.data.user.id;

  // Concurrent seed / partial page races: treat "already registered" as upsert.
  if (!isAlreadyRegisteredError(created.error.message)) {
    throw new Error(`auth.createUser ${email}: ${created.error.message}`);
  }
  const raced = await findAuthUserByEmail(admin, email);
  if (!raced) {
    throw new Error(`auth.createUser ${email}: reported existing but not found after pagination`);
  }
  return updateAuthUser(admin, raced, password, meta);
}

async function main() {
  ensureDir(OUT);
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(2);
  }
  assertStaging(url);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const password =
    process.env.PHASE17MENU2B_SYNTH_PASSWORD ||
    `Synth2b-${crypto.createHash("sha256").update(`phase17menu2b-${STAGING_REF}`).digest("hex").slice(0, 24)}`;
  // Persist for later job steps before long seed work.
  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `PHASE17MENU2B_SYNTH_PASSWORD=${password}\n`);
  }
  const dates = nextServiceDates(5);
  const matrix = {
    phase: "17MENU.2B",
    stamped_at: new Date().toISOString(),
    staging_ref: STAGING_REF,
    MARK,
    service_dates: dates,
    providers: [],
    companies: [],
    users: [],
    PRODUCTION_MUTATIONS: 0,
  };

  // Staging system_settings baseline — empty table → SETTINGS_UNAVAILABLE risk under some caches.
  {
    const { data: existingSettings } = await admin.from("system_settings").select("id").limit(1).maybeSingle();
    if (!existingSettings?.id) {
      const { error: sErr } = await admin.from("system_settings").insert({
        site_name: "Lunchportalen Staging",
        support_email: "staging@lunchportalen.test",
        ai_enabled: false,
        autopilot_enabled: false,
        toggles: {
          enforce_cutoff: true,
          require_active_agreement: true,
          employee_self_service: true,
          company_admin_can_order: true,
          strict_mode: true,
          email_backup: false,
        },
        killswitch: {
          orders: false,
          cancellations: false,
          emails: false,
          kitchen_feed: false,
          global: false,
        },
        retention: { orders_months: 18, audit_years: 5 },
        config: { [MARK]: true },
      });
      if (sErr && !/duplicate|unique/i.test(sErr.message)) {
        throw new Error(`system_settings seed: ${sErr.message}`);
      }
    }
  }

  const { data: products } = await admin
    .from("products")
    .select("id, name, sku")
    .is("company_id", null)
    .in("sku", Object.values(CHOICE_SKUS));
  const productBySku = Object.fromEntries((products ?? []).map((p) => [p.sku, p]));

  for (const cc of COUNTRIES) {
    const providerId = crypto.randomUUID();
    const slug = `${SLUG_PREFIX}${cc.toLowerCase()}`;
    const provName = `${MARK} Provider ${cc}`;
    const { data: existingProv } = await admin.from("providers").select("id").eq("slug", slug).maybeSingle();
    const pid = String(existingProv?.id ?? providerId);
    const { error: pErr } = await admin.from("providers").upsert(
      {
        id: pid,
        name: provName,
        slug,
        contact_email: `provider-${cc.toLowerCase()}@staging.lunchportalen.test`,
        billing_model: "invoice_only",
        status: "ACTIVE",
        description: MARK,
      },
      { onConflict: "slug" },
    );
    if (pErr) throw new Error(`provider ${cc}: ${pErr.message}`);

    // provider_package_entitlements FK → organizations(id); mirror provider id into organizations.
    const { error: oErr } = await admin.from("organizations").upsert({
      id: pid,
      type: "provider",
      name: provName,
      slug,
      status: "ACTIVE",
      legacy_source: "provider",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (oErr) throw new Error(`organization ${cc}: ${oErr.message}`);

    matrix.providers.push({ country: cc, id: pid, slug, reused: Boolean(existingProv?.id) });

    // Price rules per package
    for (const pkg of PACKAGES) {
      const amount = TIER_PRICE_CENTS[pkg];
      await admin.from("provider_price_rules").upsert(
        {
          provider_id: pid,
          market_code: cc,
          tier: pkg,
          amount_ex_vat: amount,
          currency: cc === "GB" ? "GBP" : cc === "US" ? "USD" : cc === "CA" ? "CAD" : cc === "CH" ? "CHF" : cc === "SE" ? "SEK" : cc === "DK" ? "DKK" : cc === "NO" ? "NOK" : "EUR",
          is_default: true,
          source: "provider",
          tax_basis: "ex_vat",
        },
        { onConflict: "provider_id,market_code,tier" },
      ).then(() => null).catch(() => null);

      // Best-effort insert without relying on unique name
      await admin.from("provider_price_rules").insert({
        provider_id: pid,
        market_code: cc,
        tier: pkg,
        amount_ex_vat: amount,
        currency: "NOK",
        is_default: true,
        source: "provider",
        tax_basis: "ex_vat",
      }).then(() => null).catch(() => null);

      for (const key of ENTITLEMENTS[pkg]) {
        const { error: eIns } = await admin.from("provider_package_entitlements").insert({
          provider_id: pid,
          package_key: pkg,
          entitlement_key: key,
          is_enabled: true,
        });
        if (eIns && !/duplicate|unique/i.test(eIns.message)) {
          throw new Error(`entitlement ${cc}/${pkg}/${key}: ${eIns.message}`);
        }
      }
    }

    for (const pkg of PACKAGES) {
      const coName = `${MARK} ${cc} ${pkg}`;
      const contactEmail = `${cc.toLowerCase()}-${pkg.toLowerCase()}-admin@staging.lunchportalen.test`;
      // Deterministic reuse by contact_email only — provider_id may change across early seed runs.
      const { data: existingCo } = await admin
        .from("companies")
        .select("id, default_location_id")
        .eq("contact_email", contactEmail)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      let companyId = String(existingCo?.id ?? crypto.randomUUID());
      let locationId = String(existingCo?.default_location_id ?? crypto.randomUUID());

      if (existingCo?.id) {
        const { error: cUp } = await admin
          .from("companies")
          .update({
            name: coName,
            status: "ACTIVE",
            provider_id: pid,
            contact_name: "Synth Admin",
            contact_email: contactEmail,
            contact_phone: "40000000",
            address: `${cc} Synth Street 1`,
            billing_country: cc,
            employee_count: 40,
          })
          .eq("id", companyId);
        if (cUp) throw new Error(`company update ${cc}/${pkg}: ${cUp.message}`);
        if (!existingCo.default_location_id) {
          const { error: locErr } = await admin.from("company_locations").insert({
            id: locationId,
            company_id: companyId,
            name: "Hovedlokasjon",
            address: `${cc} Synth Street 1`,
          });
          if (locErr && !/duplicate|unique/i.test(locErr.message)) {
            throw new Error(`location ${cc}/${pkg}: ${locErr.message}`);
          }
          await admin.from("companies").update({ default_location_id: locationId }).eq("id", companyId);
        } else {
          locationId = String(existingCo.default_location_id);
        }
      } else {
        const { error: cErr } = await admin.from("companies").insert({
          id: companyId,
          name: coName,
          status: "ACTIVE",
          orgnr: `9${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
          provider_id: pid,
          employee_count: 40,
          contact_name: "Synth Admin",
          contact_email: contactEmail,
          contact_phone: "40000000",
          address: `${cc} Synth Street 1`,
          billing_country: cc,
        });
        if (cErr) throw new Error(`company ${cc}/${pkg}: ${cErr.message}`);
        const { error: locErr } = await admin.from("company_locations").insert({
          id: locationId,
          company_id: companyId,
          name: "Hovedlokasjon",
          address: `${cc} Synth Street 1`,
        });
        if (locErr) throw new Error(`location ${cc}/${pkg}: ${locErr.message}`);
        await admin.from("companies").update({ default_location_id: locationId }).eq("id", companyId);
      }

      const price = TIER_PRICE_NOK[pkg];
      const priceCents = TIER_PRICE_CENTS[pkg];
      const { data: existingAg } = await admin
        .from("agreements")
        .select("id")
        .eq("company_id", companyId)
        .eq("status", "ACTIVE")
        .maybeSingle();
      const agreementPayload = {
        company_id: companyId,
        location_id: locationId,
        provider_id: pid,
        tier: pkg,
        status: "ACTIVE",
        delivery_days: ["mon", "tue", "wed", "thu", "fri"],
        slot_start: "11:00",
        slot_end: "13:00",
        starts_at: new Date(Date.now() - 86400_000).toISOString(),
        price_per_meal_nok: price,
      };
      const { error: aErr } = existingAg?.id
        ? await admin.from("agreements").update(agreementPayload).eq("id", existingAg.id)
        : await admin.from("agreements").insert(agreementPayload);
      if (aErr) throw new Error(`agreement ${cc}/${pkg}: ${aErr.message}`);

      const { data: agreementRow } = await admin
        .from("agreements")
        .select("id")
        .eq("company_id", companyId)
        .eq("status", "ACTIVE")
        .maybeSingle();
      const agreementId = String(agreementRow?.id ?? existingAg?.id ?? "");
      if (!agreementId) throw new Error(`agreement id missing ${cc}/${pkg}`);

      // Trigger sync_agreement_delivery_days_from_legacy_jsonb defaults day tiers to BASIS.
      // lp_order_set prices MSDI via per-day tier — force package tier on Mon–Fri.
      for (const weekday of ["mon", "tue", "wed", "thu", "fri"]) {
        const { error: addErr } = await admin.from("agreement_delivery_days").upsert(
          { agreement_id: agreementId, weekday, tier: pkg },
          { onConflict: "agreement_id,weekday" },
        );
        if (addErr) {
          const { error: addUp } = await admin
            .from("agreement_delivery_days")
            .update({ tier: pkg })
            .eq("agreement_id", agreementId)
            .eq("weekday", weekday);
          if (addUp) throw new Error(`agreement_delivery_days ${cc}/${pkg}/${weekday}: ${addUp.message || addErr.message}`);
        }
      }

      if (pkg === "ENTERPRISE") {
        await admin.from("provider_enterprise_contracts").insert({
          provider_id: pid,
          company_id: companyId,
          country_code: cc,
          currency: "NOK",
          base_price_minor: TIER_PRICE_CENTS.ENTERPRISE,
          base_price_version: "17menu2b.v1",
          included_categories: ["warm_meal", "sandwich", "salad_box"],
          included_upgrades: [],
          paid_upgrades: [{ key: "sushi", price_minor: 2500 }],
          minimum_daily_quantity: 10,
          capacity: 200,
          cutoff: "08:00",
          effective_from: new Date().toISOString().slice(0, 10),
          version: "17menu2b.v1",
          audit_event_id: `${MARK}-${cc}-ent`,
        }).then(() => null).catch(() => null);
      }

      for (const date of dates) {
        const { data: msd, error: msdErr } = await admin
          .from("menu_service_days")
          .upsert(
            {
              company_id: companyId,
              location_id: locationId,
              service_date: date,
              state: "published",
              provider_id: pid,
              cutoff_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
              published_at: new Date().toISOString(),
            },
            { onConflict: "location_id,service_date" },
          )
          .select("id")
          .maybeSingle();
        if (msdErr) throw new Error(`msd ${cc}: ${msdErr.message}`);
        const skus = ENTITLEMENTS[pkg]
          .filter((k) => k !== "enterprise_upgrade")
          .map((k) => CHOICE_SKUS[k])
          .filter(Boolean);
        // Replace items for this service day (no reliable unique constraint for upsert).
        await admin.from("menu_service_day_items").delete().eq("menu_service_day_id", msd.id);
        let i = 0;
        for (const sku of skus) {
          const p = productBySku[sku];
          if (!p) continue;
          const { error: msdiErr } = await admin.from("menu_service_day_items").insert({
            menu_service_day_id: msd.id,
            product_id: p.id,
            product_name_snapshot: p.name,
            unit_name_snapshot: "porsjon",
            offered_price_cents_ex_vat: priceCents,
            vat_rate_snapshot: 0.15,
            quantity: 1,
            sort_order: 10 + i,
            is_optional: false,
          });
          // Concurrent GHA seed runs can race on the unique (menu_service_day_id, product_id).
          if (msdiErr && !/duplicate|unique/i.test(msdiErr.message)) {
            throw new Error(`msdi ${cc}/${pkg}/${sku}: ${msdiErr.message}`);
          }
          i += 1;
        }
      }

      const empEmail = `${cc.toLowerCase()}-${pkg.toLowerCase()}-emp@staging.lunchportalen.test`;
      const adminEmail = contactEmail;
      const empId = await upsertAuthUser(admin, empEmail, password, { [MARK]: true, country: cc, package: pkg });
      const admId = await upsertAuthUser(admin, adminEmail, password, { [MARK]: true, role: "company_admin" });
      for (const [uid, role, email] of [
        [empId, "employee", empEmail],
        [admId, "company_admin", adminEmail],
      ]) {
        await admin.from("profiles").upsert({
          id: uid,
          email,
          role,
          company_id: companyId,
          location_id: locationId,
          full_name: `${MARK} ${role}`,
        }, { onConflict: "id" });
        // Stale ACTIVE orders from prior company_id rebinds fail tg_orders_hydrate_core_fields.
        await admin
          .from("orders")
          .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
          .eq("user_id", uid)
          .eq("status", "ACTIVE")
          .in("date", dates);
        // Week/orders gate calls Norway legal acceptances for all employees.
        for (const documentType of ["employee_terms", "privacy_notice"]) {
          const doc = getNorwayDocument(/** @type {any} */ (documentType));
          if (!doc) throw new Error(`missing norway doc ${documentType}`);
          const { error: lErr } = await admin.from("legal_acceptances").insert({
            subject_type: "employee",
            subject_id: uid,
            organization_id: companyId,
            actor_user_id: uid,
            country_code: "NO",
            locale: "nb-NO",
            document_type: documentType,
            document_version: doc.version,
            document_checksum: doc.checksum,
            accepted_at: new Date().toISOString(),
            acceptance_method: "clickwrap",
            audit_hash: crypto.createHash("sha256").update(`${uid}:${documentType}:${doc.version}`).digest("hex"),
          });
          if (lErr && !/duplicate|unique/i.test(lErr.message)) {
            throw new Error(`legal_acceptance ${email}/${documentType}: ${lErr.message}`);
          }
        }
      }

      // Provider admin (not customer of self — separate company not used as customer)
      const provAdminEmail = `provider-admin-${cc.toLowerCase()}@staging.lunchportalen.test`;
      const provAdminId = await upsertAuthUser(admin, provAdminEmail, password, { [MARK]: true, provider_id: pid });
      await admin.from("profiles").upsert({
        id: provAdminId,
        email: provAdminEmail,
        role: "provider_admin",
        company_id: null,
        location_id: null,
        full_name: `${MARK} Provider Admin ${cc}`,
        provider_id: pid,
      }, { onConflict: "id" }).then(() => null).catch(async () => {
        await admin.from("profiles").upsert({
          id: provAdminId,
          email: provAdminEmail,
          role: "kitchen",
          company_id: companyId,
          location_id: locationId,
          full_name: `${MARK} Kitchen ${cc}`,
        }, { onConflict: "id" });
      });

      matrix.companies.push({
        country: cc,
        package: pkg,
        company_id: companyId,
        location_id: locationId,
        provider_id: pid,
        employee_email: empEmail,
        admin_email: adminEmail,
      });
      matrix.users.push({ email: empEmail, role: "employee", country: cc, package: pkg });
    }
  }

  const redacted = {
    ...matrix,
    password_present: true,
    users: matrix.users.map((u) => ({ ...u, email: u.email.replace(/@.*/, "@staging.lunchportalen.test") })),
  };
  fs.writeFileSync(path.join(OUT, "synthetic-matrix.json"), JSON.stringify(redacted, null, 2));
  console.log(JSON.stringify({
    providers: matrix.providers.length,
    companies: matrix.companies.length,
    users: matrix.users.length,
    MARK,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

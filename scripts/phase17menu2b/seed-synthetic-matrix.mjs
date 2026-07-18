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
  thai: "thai",
};

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

async function upsertAuthUser(admin, email, password, meta) {
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = (listed.data?.users ?? []).find((u) => u.email === email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: meta,
      app_metadata: { ...(existing.app_metadata ?? {}), [MARK]: true },
    });
    return existing.id;
  }
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: meta,
    app_metadata: { [MARK]: true },
  });
  if (created.error) throw new Error(`auth.createUser ${email}: ${created.error.message}`);
  return created.data.user.id;
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
    providers: [],
    companies: [],
    users: [],
    PRODUCTION_MUTATIONS: 0,
  };

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
      const amount = pkg === "BASIS" ? 8900 : pkg === "LUXUS" ? 11900 : 10900;
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
      const companyId = crypto.randomUUID();
      const locationId = crypto.randomUUID();
      const coName = `${MARK} ${cc} ${pkg}`;
      const { error: cErr } = await admin.from("companies").insert({
        id: companyId,
        name: coName,
        status: "ACTIVE",
        orgnr: `9${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
        provider_id: pid,
        employee_count: 40,
        contact_name: "Synth Admin",
        contact_email: `${cc.toLowerCase()}-${pkg.toLowerCase()}-admin@staging.lunchportalen.test`,
        contact_phone: "40000000",
        address: `${cc} Synth Street 1`,
        billing_country: cc,
      });
      if (cErr) throw new Error(`company ${cc}/${pkg}: ${cErr.message}`);
      await admin.from("company_locations").insert({
        id: locationId,
        company_id: companyId,
        name: "Hovedlokasjon",
        address: `${cc} Synth Street 1`,
      });
      await admin.from("companies").update({ default_location_id: locationId }).eq("id", companyId);

      const price =
        pkg === "BASIS" ? 89 : pkg === "LUXUS" ? 119 : 109;
      const { error: aErr } = await admin.from("agreements").insert({
        company_id: companyId,
        location_id: locationId,
        provider_id: pid,
        tier: pkg,
        status: "ACTIVE",
        delivery_days: ["mon", "tue", "wed", "thu", "fri"],
        slot_start: "11:00",
        slot_end: "13:00",
        starts_at: new Date().toISOString(),
        price_per_meal_nok: price,
      });
      if (aErr) throw new Error(`agreement ${cc}/${pkg}: ${aErr.message}`);

      if (pkg === "ENTERPRISE") {
        await admin.from("provider_enterprise_contracts").insert({
          provider_id: pid,
          company_id: companyId,
          country_code: cc,
          currency: "NOK",
          base_price_minor: 10900,
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
        let i = 0;
        for (const sku of skus) {
          const p = productBySku[sku];
          if (!p) continue;
          await admin.from("menu_service_day_items").insert({
            menu_service_day_id: msd.id,
            product_id: p.id,
            product_name_snapshot: p.name,
            unit_name_snapshot: "porsjon",
            offered_price_cents_ex_vat: price * 100,
            vat_rate_snapshot: 0.15,
            quantity: 1,
            sort_order: 10 + i,
            is_optional: false,
          });
          i += 1;
        }
      }

      const empEmail = `${cc.toLowerCase()}-${pkg.toLowerCase()}-emp@staging.lunchportalen.test`;
      const adminEmail = `${cc.toLowerCase()}-${pkg.toLowerCase()}-admin@staging.lunchportalen.test`;
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
            acceptance_method: "synthetic_seed",
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

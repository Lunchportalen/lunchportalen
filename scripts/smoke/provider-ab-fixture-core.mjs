/**
 * Pure Provider A/B fixture helpers (no pg / no env I/O).
 * Imported by seed-provider-ab-fixture.mjs and static tests.
 */
import {
  FIXTURE_BASIS_PRICE_CENTS,
  FIXTURE_DATE,
  FIXTURE_MENU_CATEGORY_DB,
  FIXTURE_TIER,
  PROD_PROJECT_REF,
  PROVIDER_A,
  PROVIDER_B,
  STAGING_PROJECT_REF,
} from "./fixtures/provider-ab-staging.constants.mjs";

export { STAGING_PROJECT_REF, PROD_PROJECT_REF, PROVIDER_A, PROVIDER_B };

/**
 * Fail-closed staging URL guard. Never uses raw DATABASE_URL when it points at prod.
 * @param {{ key: string, url: string } | null} picked
 */
export function assertStagingDatabaseUrl(picked) {
  if (!picked?.url) {
    throw new Error(
      "ABORT: no uigx database URL — set STAGING_DATABASE_URL or SUPABASE_POSTGRES_URL containing uigxsboqeruxflgzqztl",
    );
  }
  const url = picked.url;
  if (url.includes(PROD_PROJECT_REF) && !url.includes(STAGING_PROJECT_REF)) {
    throw new Error(`ABORT: refuse prod ref ${PROD_PROJECT_REF} without staging ref`);
  }
  if (!url.includes(STAGING_PROJECT_REF)) {
    throw new Error(`ABORT: database URL must contain staging ref ${STAGING_PROJECT_REF}`);
  }
  return picked;
}

/**
 * Pure validation for tests — no I/O.
 */
export function validateProviderAbFixtureConstants() {
  const errors = [];
  if (PROVIDER_A.providerId === PROVIDER_B.providerId) {
    errors.push("provider A/B ids must differ");
  }
  if (PROVIDER_A.companyId === PROVIDER_B.companyId) {
    errors.push("company A/B ids must differ");
  }
  const aFrom = Number(PROVIDER_A.coverageFrom);
  const aTo = Number(PROVIDER_A.coverageTo);
  const bFrom = Number(PROVIDER_B.coverageFrom);
  const bTo = Number(PROVIDER_B.coverageTo);
  if (!(aTo < bFrom || bTo < aFrom)) {
    errors.push("coverage postal ranges must not overlap");
  }
  if (PROVIDER_A.testPostalCode < PROVIDER_A.coverageFrom || PROVIDER_A.testPostalCode > PROVIDER_A.coverageTo) {
    errors.push("provider A test postal code outside A coverage");
  }
  if (PROVIDER_B.testPostalCode < PROVIDER_B.coverageFrom || PROVIDER_B.testPostalCode > PROVIDER_B.coverageTo) {
    errors.push("provider B test postal code outside B coverage");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Build idempotent SQL (UPSERT / scoped UPDATE only — no DELETE/TRUNCATE).
 * @returns {string}
 */
export function buildProviderAbFixtureSql() {
  const a = PROVIDER_A;
  const b = PROVIDER_B;
  const deliveryDaysJson = `'["mon","tue","wed","thu","fri"]'::jsonb`;
  const agreementStart = "2026-04-23";
  const agreementEnd = "2026-08-21";

  return `
-- provider-ab-staging-fixture (deterministic, idempotent, uigx only)

-- ── A) Provider A correction (scoped fixture IDs only) ─────────────────────
update public.companies
set provider_id = '${a.providerId}'::uuid,
    updated_at = now()
where id = '${a.companyId}'::uuid
  and provider_id is distinct from '${a.providerId}'::uuid;

update public.agreements
set provider_id = '${a.providerId}'::uuid,
    updated_at = now()
where id = '${a.agreementId}'::uuid
  and provider_id is distinct from '${a.providerId}'::uuid;

insert into public.provider_service_areas (
  id, provider_id, country, city, postal_code_from, postal_code_to, min_employees, active
)
values (
  '${a.serviceAreaId}'::uuid,
  '${a.providerId}'::uuid,
  'NO',
  '${a.coverageCity}',
  '${a.coverageFrom}',
  '${a.coverageTo}',
  20,
  true
)
on conflict (id) do update set
  provider_id = excluded.provider_id,
  city = excluded.city,
  postal_code_from = excluded.postal_code_from,
  postal_code_to = excluded.postal_code_to,
  active = true;

insert into public.provider_settings (
  provider_id,
  default_currency,
  default_country_code,
  timezone,
  cutoff_time,
  kitchen_buffer_minutes,
  delivery_days,
  locale,
  operations_email,
  kitchen_email,
  delivery_email
)
values (
  '${a.providerId}'::uuid,
  'NOK',
  'NO',
  'Europe/Oslo',
  '08:00',
  5,
  ${deliveryDaysJson},
  'nb-NO',
  '${a.opsEmail}',
  '${a.kitchenEmail}',
  '${a.deliveryEmail}'
)
on conflict (provider_id) do update set
  operations_email = coalesce(public.provider_settings.operations_email, excluded.operations_email),
  kitchen_email = coalesce(public.provider_settings.kitchen_email, excluded.kitchen_email),
  delivery_email = coalesce(public.provider_settings.delivery_email, excluded.delivery_email),
  updated_at = now();

-- ── B) Provider B (staging-only) ───────────────────────────────────────────
insert into public.providers (
  id, name, slug, status, contact_email, billing_model, description, created_at, updated_at
)
values (
  '${b.providerId}'::uuid,
  '${b.name}',
  '${b.slug}',
  'ACTIVE',
  '${b.contactEmail}',
  'SAAS_FIXED',
  'Staging-only Provider B for multi-provider A/B proof.',
  now(),
  now()
)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  status = excluded.status,
  contact_email = excluded.contact_email,
  billing_model = excluded.billing_model,
  description = excluded.description,
  updated_at = now();

insert into public.organizations (
  id, type, name, slug, org_number, status, legacy_source, customer_provider_org_id, created_at, updated_at
)
values (
  '${b.providerId}'::uuid,
  'provider'::public.org_type,
  '${b.name}',
  '${b.slug}',
  null,
  'ACTIVE',
  'provider',
  null,
  now(),
  now()
)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  status = excluded.status,
  updated_at = now();

insert into public.companies (
  id, orgnr, name, status, timezone, provider_id, legal_name, billing_country, created_at, updated_at
)
values (
  '${b.companyId}'::uuid,
  '${b.orgnr}',
  'Company B (provider-ab-staging)',
  'ACTIVE',
  'Europe/Oslo',
  '${b.providerId}'::uuid,
  'Company B (provider-ab-staging)',
  'NO',
  now(),
  now()
)
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  provider_id = excluded.provider_id,
  orgnr = excluded.orgnr,
  updated_at = now();

insert into public.organizations (
  id, type, name, slug, org_number, status, legacy_source, customer_provider_org_id, created_at, updated_at
)
values (
  '${b.companyId}'::uuid,
  'customer'::public.org_type,
  'Company B (provider-ab-staging)',
  null,
  '${b.orgnr}',
  'ACTIVE',
  'company',
  '${b.providerId}'::uuid,
  now(),
  now()
)
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  customer_provider_org_id = excluded.customer_provider_org_id,
  updated_at = now();

insert into public.company_locations (
  id, company_id, name, status, created_at, updated_at
)
values (
  '${b.locationId}'::uuid,
  '${b.companyId}'::uuid,
  'Loc B (provider-ab-staging)',
  'ACTIVE',
  now(),
  now()
)
on conflict (id) do update set
  company_id = excluded.company_id,
  name = excluded.name,
  status = excluded.status,
  updated_at = now();

update public.companies
set default_location_id = '${b.locationId}'::uuid,
    updated_at = now()
where id = '${b.companyId}'::uuid;

insert into public.agreements (
  id,
  company_id,
  location_id,
  tier,
  status,
  delivery_days,
  slot_start,
  slot_end,
  starts_at,
  ends_at,
  currency,
  price_per_meal_nok,
  price_per_meal_luxus_nok,
  billing_cycle,
  binding_months,
  notice_months,
  start_date,
  provider_id,
  approved_at,
  activated_at,
  created_at,
  updated_at
)
values (
  '${b.agreementId}'::uuid,
  '${b.companyId}'::uuid,
  '${b.locationId}'::uuid,
  '${FIXTURE_TIER}',
  'ACTIVE',
  ${deliveryDaysJson},
  '11:00:00',
  '13:00:00',
  '${agreementStart}'::date,
  '${agreementEnd}'::date,
  'NOK',
  90,
  130,
  'monthly',
  12,
  3,
  '${agreementStart}'::date,
  '${b.providerId}'::uuid,
  now(),
  now(),
  now(),
  now()
)
on conflict (id) do update set
  company_id = excluded.company_id,
  location_id = excluded.location_id,
  tier = excluded.tier,
  status = excluded.status,
  delivery_days = excluded.delivery_days,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  provider_id = excluded.provider_id,
  approved_at = excluded.approved_at,
  activated_at = excluded.activated_at,
  updated_at = now();

insert into public.agreement_delivery_days (agreement_id, weekday, tier, created_at)
values
  ('${b.agreementId}'::uuid, 'mon', '${FIXTURE_TIER}', now()),
  ('${b.agreementId}'::uuid, 'tue', '${FIXTURE_TIER}', now()),
  ('${b.agreementId}'::uuid, 'wed', '${FIXTURE_TIER}', now()),
  ('${b.agreementId}'::uuid, 'thu', '${FIXTURE_TIER}', now()),
  ('${b.agreementId}'::uuid, 'fri', '${FIXTURE_TIER}', now())
on conflict (agreement_id, weekday) do update set tier = excluded.tier;

insert into public.provider_settings (
  provider_id,
  default_currency,
  default_country_code,
  timezone,
  cutoff_time,
  kitchen_buffer_minutes,
  delivery_days,
  locale,
  operations_email,
  kitchen_email,
  delivery_email
)
values (
  '${b.providerId}'::uuid,
  'NOK',
  'NO',
  'Europe/Oslo',
  '08:00',
  5,
  ${deliveryDaysJson},
  'nb-NO',
  '${b.opsEmail}',
  '${b.kitchenEmail}',
  '${b.deliveryEmail}'
)
on conflict (provider_id) do update set
  operations_email = excluded.operations_email,
  kitchen_email = excluded.kitchen_email,
  delivery_email = excluded.delivery_email,
  updated_at = now();

insert into public.provider_service_areas (
  id, provider_id, country, city, postal_code_from, postal_code_to, min_employees, active
)
values (
  '${b.serviceAreaId}'::uuid,
  '${b.providerId}'::uuid,
  'NO',
  '${b.coverageCity}',
  '${b.coverageFrom}',
  '${b.coverageTo}',
  20,
  true
)
on conflict (id) do update set
  provider_id = excluded.provider_id,
  city = excluded.city,
  postal_code_from = excluded.postal_code_from,
  postal_code_to = excluded.postal_code_to,
  active = true;

insert into public.product_categories (id, name, sort_order, created_at, updated_at)
values (
  '${a.productCategoryId}'::uuid,
  '${FIXTURE_MENU_CATEGORY_DB}',
  0,
  now(),
  now()
)
on conflict (name) do update set updated_at = now();

insert into public.products (
  id,
  company_id,
  category_id,
  name,
  description,
  sku,
  unit_name,
  vat_rate,
  base_price_cents_ex_vat,
  currency_code,
  is_active,
  is_visible,
  sort_order,
  created_at,
  updated_at
)
values (
  '${b.productId}'::uuid,
  '${b.companyId}'::uuid,
  (select id from public.product_categories where name = '${FIXTURE_MENU_CATEGORY_DB}' limit 1),
  '${b.menuLabel}',
  'Provider B A/B fixture product',
  '${b.productSku}',
  'kuvert',
  0.15,
  ${FIXTURE_BASIS_PRICE_CENTS},
  'NOK',
  true,
  true,
  0,
  now(),
  now()
)
on conflict (id) do update set
  company_id = excluded.company_id,
  name = excluded.name,
  is_active = true,
  is_visible = true,
  updated_at = now();

insert into public.menu_service_days (
  id, company_id, location_id, service_date, state, provider_id, created_at, updated_at
)
values (
  '${b.menuServiceDayId}'::uuid,
  '${b.companyId}'::uuid,
  '${b.locationId}'::uuid,
  '${FIXTURE_DATE}'::date,
  'published',
  '${b.providerId}'::uuid,
  now(),
  now()
)
on conflict (location_id, service_date) do update set
  state = 'published',
  company_id = excluded.company_id,
  provider_id = excluded.provider_id,
  updated_at = now();

insert into public.menu_service_day_items (
  id,
  menu_service_day_id,
  product_id,
  product_name_snapshot,
  unit_name_snapshot,
  offered_price_cents_ex_vat,
  vat_rate_snapshot,
  quantity,
  sort_order,
  is_optional,
  created_at,
  updated_at
)
values (
  '${b.menuItemId}'::uuid,
  '${b.menuServiceDayId}'::uuid,
  '${b.productId}'::uuid,
  '${b.menuLabel}',
  'kuvert',
  ${FIXTURE_BASIS_PRICE_CENTS},
  0.15,
  1,
  0,
  false,
  now(),
  now()
)
on conflict (menu_service_day_id, product_id) do update set
  product_name_snapshot = excluded.product_name_snapshot,
  offered_price_cents_ex_vat = excluded.offered_price_cents_ex_vat,
  updated_at = now();
`;
}

-- Deterministic staging tenant seed for DC-011 A6 / Company A (agreements-test).
-- Source: uigx snapshot 2026-05-30 (read-only export). Idempotent: ON CONFLICT DO UPDATE.
-- Target project: uigxsboqeruxflgzqztl ONLY. Run after migrations, before provision-smoke-user + menu seed.
--
-- Restores:
--   providers (company + agreement FK)
--   company 8b0b8fa4-8d89-4795-b92b-e09129dd635f
--   location f319b299-8914-4c52-9984-569ce07c914d
--   ACTIVE agreement 2356f773-… (BASIS, mon–fri incl. wed → 2026-06-04)
--   smoke profile + company_membership + location_membership (b0e90b33-…)
--
-- Auth user (auth.users) is NOT in SQL — use scripts/smoke/provision-smoke-user.mjs after this.
-- Menu (menu_service_days/items) — use scripts/smoke/seed-smoke-menu-fixture.mjs after this.

begin;

-- ── Providers (FK: companies.provider_id, agreements.provider_id) ─────────────
insert into public.providers (
  id,
  name,
  slug,
  org_number,
  status,
  contact_email,
  contact_phone,
  logo_url,
  primary_color,
  description,
  billing_model,
  created_at,
  updated_at,
  suspended_at,
  suspended_by,
  suspended_reason,
  paused_at,
  paused_by,
  paused_reason,
  deleted_at
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'Melhus Catering AS',
    'melhus-catering',
    null,
    'ACTIVE',
    'kontakt@melhuscatering.no',
    null,
    null,
    null,
    'Leverer bedriftslunsj i Trondheim og omegn. Mandag-fredag.',
    'SAAS_FIXED',
    '2026-05-20 11:08:36.711328+00',
    '2026-05-20 11:08:36.711328+00',
    null,
    null,
    null,
    null,
    null,
    null,
    null
  ),
  (
    '744b4067-6655-429e-a6ee-ab014634a2f7',
    'FX Provider A f259c96b',
    'fx-a-f259c96b',
    null,
    'ACTIVE',
    'a.f259c96b@test.lunchportalen.no',
    null,
    null,
    null,
    null,
    'SAAS_FIXED',
    '2026-05-20 16:20:28.403446+00',
    '2026-05-20 16:20:28.403446+00',
    null,
    null,
    null,
    null,
    null,
    null,
    null
  )
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  status = excluded.status,
  contact_email = excluded.contact_email,
  billing_model = excluded.billing_model,
  updated_at = excluded.updated_at;

-- ── Company ───────────────────────────────────────────────────────────────────
insert into public.companies (
  id,
  orgnr,
  name,
  status,
  employee_count,
  contact_name,
  contact_email,
  contact_phone,
  address,
  enterprise_group_id,
  created_at,
  updated_at,
  deleted_at,
  deleted_by,
  delete_reason,
  slug,
  organization_number,
  billing_email,
  timezone,
  created_by,
  default_location_id,
  provider_id,
  logo_url,
  suspended_at,
  suspended_by,
  suspended_reason,
  paused_at,
  paused_by,
  paused_reason,
  legal_name,
  billing_address,
  billing_postcode,
  billing_city,
  ehf_enabled,
  ehf_endpoint,
  billing_country
)
values (
  '8b0b8fa4-8d89-4795-b92b-e09129dd635f',
  '1779320457527',
  'Company A (agreements-test)',
  'ACTIVE',
  null,
  null,
  null,
  null,
  null,
  null,
  '2026-05-20 23:40:58.838477+00',
  '2026-05-22 10:49:34.888412+00',
  null,
  null,
  null,
  null,
  null,
  null,
  'Europe/Oslo',
  null,
  null,
  '11111111-1111-1111-1111-111111111111',
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  'Company A (agreements-test)',
  null,
  null,
  null,
  false,
  null,
  'NO'
)
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  provider_id = excluded.provider_id,
  default_location_id = excluded.default_location_id,
  updated_at = excluded.updated_at;

-- ── Location ──────────────────────────────────────────────────────────────────
insert into public.company_locations (
  id,
  company_id,
  name,
  address,
  status,
  slot_policy,
  created_at,
  updated_at
)
values (
  'f319b299-8914-4c52-9984-569ce07c914d',
  '8b0b8fa4-8d89-4795-b92b-e09129dd635f',
  'Loc A (agreements-test)',
  null,
  'ACTIVE',
  null,
  '2026-05-20 23:40:58.98326+00',
  '2026-05-20 23:40:58.98326+00'
)
on conflict (id) do update set
  company_id = excluded.company_id,
  name = excluded.name,
  status = excluded.status,
  updated_at = excluded.updated_at;

update public.companies
set default_location_id = 'f319b299-8914-4c52-9984-569ce07c914d',
    updated_at = now()
where id = '8b0b8fa4-8d89-4795-b92b-e09129dd635f';

-- ── Agreement (ACTIVE, covers 2026-06-04 Wednesday) ───────────────────────────
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
  created_at,
  updated_at,
  comment_from_company,
  comment_from_superadmin,
  start_date,
  submitted_by_email,
  submitted_by_name,
  reviewed_by,
  reviewed_at,
  approved_at,
  activated_at,
  rejected_at,
  rejection_reason,
  rejected_reason_internal,
  price_per_employee,
  price_per_meal_enterprise_nok,
  provider_id,
  billing_anchor_date,
  last_invoiced_at
)
values (
  '2356f773-3d59-407e-9fba-536dbb44b2e2',
  '8b0b8fa4-8d89-4795-b92b-e09129dd635f',
  'f319b299-8914-4c52-9984-569ce07c914d',
  'BASIS',
  'ACTIVE',
  '["mon","tue","wed","thu","fri"]'::jsonb,
  '11:00:00',
  '13:00:00',
  '2026-04-23',
  '2026-08-21',
  'NOK',
  90,
  130,
  'monthly',
  12,
  3,
  '2026-05-23 19:51:22.57542+00',
  '2026-05-23 19:51:22.57542+00',
  null,
  null,
  '2026-04-23',
  null,
  null,
  null,
  null,
  '2026-05-23 19:51:22.57542+00',
  '2026-05-23 19:51:22.57542+00',
  null,
  null,
  null,
  null,
  null,
  '744b4067-6655-429e-a6ee-ab014634a2f7',
  null,
  null
)
on conflict (id) do update set
  status = excluded.status,
  tier = excluded.tier,
  delivery_days = excluded.delivery_days,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  provider_id = excluded.provider_id,
  approved_at = excluded.approved_at,
  activated_at = excluded.activated_at,
  updated_at = excluded.updated_at;

insert into public.agreement_delivery_days (agreement_id, weekday, created_at, tier)
values
  ('2356f773-3d59-407e-9fba-536dbb44b2e2', 'mon', '2026-05-23 19:51:22.57542+00', 'BASIS'),
  ('2356f773-3d59-407e-9fba-536dbb44b2e2', 'tue', '2026-05-23 19:51:22.57542+00', 'BASIS'),
  ('2356f773-3d59-407e-9fba-536dbb44b2e2', 'wed', '2026-05-23 19:51:22.57542+00', 'BASIS'),
  ('2356f773-3d59-407e-9fba-536dbb44b2e2', 'thu', '2026-05-23 19:51:22.57542+00', 'BASIS'),
  ('2356f773-3d59-407e-9fba-536dbb44b2e2', 'fri', '2026-05-23 19:51:22.57542+00', 'BASIS')
on conflict (agreement_id, weekday) do update set
  tier = excluded.tier;

-- Profile + memberships: scripts/smoke/provision-smoke-user.mjs + .smoke-provision.sql

commit;

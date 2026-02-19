-- supabase/migrations/20260218_step1_4_schema_safe_hardening.sql
-- Purpose:
-- - Schema-safe hardening for companies/agreements/outbox
-- - Deterministic, fail-closed RPC for company registration + agreement approval
-- - Security tightening (service_role only) for privileged RPC

begin;

-- =========================================================
-- 0) Pre-flight assertions (fail-closed)
-- =========================================================
do $$
begin
  if to_regclass('public.companies') is null then
    raise exception 'required table missing: public.companies';
  end if;
  if to_regclass('public.agreements') is null then
    raise exception 'required table missing: public.agreements';
  end if;
  if to_regclass('public.outbox') is null then
    raise exception 'required table missing: public.outbox';
  end if;
end
$$;

do $$
declare
  v_missing text[];
begin
  select array_agg(c) into v_missing
  from (
    select c
    from unnest(array[
      'event_key',
      'status',
      'attempts',
      'last_error',
      'locked_at',
      'locked_by'
    ]) as c
    where not exists (
      select 1
      from information_schema.columns ic
      where ic.table_schema = 'public'
        and ic.table_name = 'outbox'
        and ic.column_name = c
    )
  ) q;

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'outbox missing required base columns: %', v_missing;
  end if;
end
$$;

do $$
declare
  v_missing text[];
begin
  select array_agg(c) into v_missing
  from (
    select c
    from unnest(array[
      'id',
      'orgnr',
      'name',
      'status',
      'employee_count',
      'contact_name',
      'contact_email',
      'contact_phone',
      'address',
      'created_at'
    ]) as c
    where not exists (
      select 1
      from information_schema.columns ic
      where ic.table_schema = 'public'
        and ic.table_name = 'companies'
        and ic.column_name = c
    )
  ) q;

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'companies missing required columns: %', v_missing;
  end if;
end
$$;

do $$
declare
  v_missing text[];
begin
  select array_agg(c) into v_missing
  from (
    select c
    from unnest(array[
      'id',
      'company_id',
      'status',
      'starts_at'
    ]) as c
    where not exists (
      select 1
      from information_schema.columns ic
      where ic.table_schema = 'public'
        and ic.table_name = 'agreements'
        and ic.column_name = c
    )
  ) q;

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'agreements missing required columns: %', v_missing;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
      and t.typname = 'company_status'
      and e.enumlabel in ('PENDING','ACTIVE','PAUSED','CLOSED')
    group by t.typname
    having count(distinct e.enumlabel) = 4
  ) then
    raise exception 'enum public.company_status must include PENDING, ACTIVE, PAUSED, CLOSED';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
      and t.typname = 'agreement_status'
      and e.enumlabel in ('PENDING','ACTIVE','TERMINATED')
    group by t.typname
    having count(distinct e.enumlabel) = 3
  ) then
    raise exception 'enum public.agreement_status must include PENDING, ACTIVE, TERMINATED';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
      and t.typname = 'agreement_tier'
      and e.enumlabel in ('BASIS','LUXUS')
    group by t.typname
    having count(distinct e.enumlabel) = 2
  ) then
    raise exception 'enum public.agreement_tier must include BASIS, LUXUS';
  end if;
end
$$;

-- =========================================================
-- 1) Outbox hardening (schema-safe)
-- =========================================================
alter table public.outbox
  add column if not exists payload jsonb,
  add column if not exists next_retry_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  v_missing text[];
begin
  select array_agg(c) into v_missing
  from (
    select c
    from unnest(array[
      'event_key',
      'payload',
      'status',
      'attempts',
      'last_error',
      'locked_at',
      'locked_by',
      'next_retry_at',
      'delivered_at',
      'updated_at'
    ]) as c
    where not exists (
      select 1
      from information_schema.columns ic
      where ic.table_schema = 'public'
        and ic.table_name = 'outbox'
        and ic.column_name = c
    )
  ) q;

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'outbox missing required write columns: %', v_missing;
  end if;
end
$$;

create unique index if not exists outbox_event_key_uniq
  on public.outbox (event_key);

-- =========================================================
-- 2) Companies hardening (lookup + registration integrity)
-- =========================================================
do $$
begin
  if exists (
    select 1
    from public.companies c
    where c.orgnr is not null
    group by c.orgnr
    having count(*) > 1
  ) then
    raise exception 'duplicate orgnr detected in public.companies';
  end if;
end
$$;

create unique index if not exists companies_orgnr_unique_not_null
  on public.companies (orgnr)
  where orgnr is not null;

create index if not exists companies_status_idx
  on public.companies (status);

create index if not exists companies_created_at_idx
  on public.companies (created_at desc);

alter table public.companies
  drop constraint if exists companies_pending_registration_fields_ck;

alter table public.companies
  add constraint companies_pending_registration_fields_ck
  check (
    status <> 'PENDING'::public.company_status
    or (
      employee_count is not null
      and employee_count >= 20
      and contact_name is not null
      and btrim(contact_name) <> ''
      and contact_email is not null
      and btrim(contact_email) <> ''
      and contact_phone is not null
      and btrim(contact_phone) <> ''
      and address is not null
      and btrim(address) <> ''
    )
  ) not valid;

-- =========================================================
-- 3) Agreements hardening (active uniqueness + guard indexes)
-- =========================================================
create index if not exists agreements_company_status_idx
  on public.agreements (company_id, status);

create index if not exists agreements_company_status_starts_at_idx
  on public.agreements (company_id, status, starts_at);

do $$
begin
  if exists (
    select 1
    from public.agreements a
    where a.status = 'ACTIVE'::public.agreement_status
    group by a.company_id
    having count(*) > 1
  ) then
    raise exception 'cannot enforce one ACTIVE agreement per company: duplicate ACTIVE agreements detected';
  end if;
end
$$;

create unique index if not exists agreements_one_active_per_company_uk
  on public.agreements (company_id)
  where status = 'ACTIVE'::public.agreement_status;

-- =========================================================
-- 4) RPC: lp_company_register (deterministic, fail-closed)
-- =========================================================
drop function if exists public.lp_company_register(
  text,
  text,
  text,
  text,
  integer,
  text,
  text
);

create or replace function public.lp_company_register(
  p_address text,
  p_contact_email text,
  p_contact_name text,
  p_contact_phone text,
  p_employee_count integer,
  p_name text,
  p_orgnr text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_company_id uuid;
  v_status public.company_status;
  v_now timestamptz := clock_timestamp();

  v_name text := btrim(coalesce(p_name, ''));
  v_orgnr text := regexp_replace(btrim(coalesce(p_orgnr, '')), '\D', '', 'g');
  v_contact_name text := btrim(coalesce(p_contact_name, ''));
  v_contact_email text := lower(btrim(coalesce(p_contact_email, '')));
  v_contact_phone text := btrim(coalesce(p_contact_phone, ''));
  v_address text := btrim(coalesce(p_address, ''));
  v_should_emit boolean := false;
begin
  if to_regclass('public.outbox') is null then
    raise exception 'required table missing: public.outbox';
  end if;

  if v_name = '' then
    raise exception using errcode = 'P0001', message = 'NAME_REQUIRED';
  end if;
  if length(v_orgnr) <> 9 then
    raise exception using errcode = 'P0001', message = 'ORGNR_MUST_BE_9_DIGITS';
  end if;
  if p_employee_count is null or p_employee_count < 20 then
    raise exception using errcode = 'P0001', message = 'EMPLOYEE_COUNT_MIN_20';
  end if;
  if v_contact_name = '' then
    raise exception using errcode = 'P0001', message = 'CONTACT_NAME_REQUIRED';
  end if;
  if v_contact_email = '' then
    raise exception using errcode = 'P0001', message = 'CONTACT_EMAIL_REQUIRED';
  end if;
  if v_contact_phone = '' then
    raise exception using errcode = 'P0001', message = 'CONTACT_PHONE_REQUIRED';
  end if;
  if v_address = '' then
    raise exception using errcode = 'P0001', message = 'ADDRESS_REQUIRED';
  end if;

  select c.id, c.status
    into v_company_id, v_status
  from public.companies c
  where c.orgnr = v_orgnr
  order by c.id
  limit 1
  for update;

  if v_company_id is null then
    insert into public.companies (
      name,
      orgnr,
      status,
      employee_count,
      contact_name,
      contact_email,
      contact_phone,
      address
    )
    values (
      v_name,
      v_orgnr,
      'PENDING'::public.company_status,
      p_employee_count,
      v_contact_name,
      v_contact_email,
      v_contact_phone,
      v_address
    )
    returning id, status
      into v_company_id, v_status;

    v_should_emit := true;
  else
    update public.companies c
       set name = v_name,
           employee_count = p_employee_count,
           contact_name = v_contact_name,
           contact_email = v_contact_email,
           contact_phone = v_contact_phone,
           address = v_address,
           updated_at = now()
     where c.id = v_company_id;

    if v_status = 'PENDING'::public.company_status then
      v_should_emit := true;
    end if;
  end if;

  if v_should_emit then
    insert into public.outbox (
      event_key,
      payload,
      status,
      attempts,
      last_error,
      locked_at,
      locked_by,
      next_retry_at,
      delivered_at
    )
    values (
      format('company.registered:%s', v_company_id::text),
      jsonb_build_object(
        'event', 'company.registered',
        'companyId', v_company_id,
        'status', v_status,
        'receipt', v_now
      ),
      'PENDING',
      0,
      null,
      null,
      null,
      null,
      null
    )
    on conflict (event_key) do update
      set payload = excluded.payload,
          status = 'PENDING',
          attempts = 0,
          last_error = null,
          locked_at = null,
          locked_by = null,
          next_retry_at = null,
          delivered_at = null,
          updated_at = now();
  end if;

  return jsonb_build_object(
    'company_id', v_company_id,
    'status', v_status,
    'receipt', v_now
  );
end
$$;

-- =========================================================
-- 5) RPC: lp_agreement_approve (atomic, race-safe)
-- =========================================================
drop function if exists public.lp_agreement_approve(uuid);

create or replace function public.lp_agreement_approve(
  p_agreement_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_agreement public.agreements%rowtype;
  v_company_status public.company_status;
  v_other_active uuid;
  v_prev_status public.agreement_status;
  v_now timestamptz := clock_timestamp();
begin
  if p_agreement_id is null then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_ID_REQUIRED';
  end if;

  if to_regclass('public.outbox') is null then
    raise exception 'required table missing: public.outbox';
  end if;

  select a.*
    into v_agreement
  from public.agreements a
  where a.id = p_agreement_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'AGREEMENT_NOT_FOUND';
  end if;

  v_prev_status := v_agreement.status;

  if v_prev_status = 'TERMINATED'::public.agreement_status then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_NOT_APPROVABLE';
  end if;

  select c.status
    into v_company_status
  from public.companies c
  where c.id = v_agreement.company_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'COMPANY_NOT_FOUND';
  end if;

  select a.id
    into v_other_active
  from public.agreements a
  where a.company_id = v_agreement.company_id
    and a.status = 'ACTIVE'::public.agreement_status
    and a.id <> v_agreement.id
  for update
  limit 1;

  if v_other_active is not null then
    raise exception using errcode = '23505', message = 'ACTIVE_AGREEMENT_EXISTS';
  end if;

  if v_prev_status <> 'ACTIVE'::public.agreement_status then
    update public.agreements a
       set status = 'ACTIVE'::public.agreement_status,
           updated_at = now()
     where a.id = v_agreement.id;
  end if;

  if v_company_status = 'PENDING'::public.company_status then
    update public.companies c
       set status = 'ACTIVE'::public.company_status,
           updated_at = now()
     where c.id = v_agreement.company_id;
    v_company_status := 'ACTIVE'::public.company_status;
  end if;

  if v_prev_status <> 'ACTIVE'::public.agreement_status then
    insert into public.outbox (
      event_key,
      payload,
      status,
      attempts,
      last_error,
      locked_at,
      locked_by,
      next_retry_at,
      delivered_at
    )
    values (
      format('agreement.activated:%s', v_agreement.id::text),
      jsonb_build_object(
        'event', 'agreement.activated',
        'agreementId', v_agreement.id,
        'companyId', v_agreement.company_id,
        'receipt', v_now
      ),
      'PENDING',
      0,
      null,
      null,
      null,
      null,
      null
    )
    on conflict (event_key) do update
      set payload = excluded.payload,
          status = 'PENDING',
          attempts = 0,
          last_error = null,
          locked_at = null,
          locked_by = null,
          next_retry_at = null,
          delivered_at = null,
          updated_at = now();

    insert into public.outbox (
      event_key,
      payload,
      status,
      attempts,
      last_error,
      locked_at,
      locked_by,
      next_retry_at,
      delivered_at
    )
    values (
      format('company.activated:%s', v_agreement.company_id::text),
      jsonb_build_object(
        'event', 'company.activated',
        'agreementId', v_agreement.id,
        'companyId', v_agreement.company_id,
        'receipt', v_now
      ),
      'PENDING',
      0,
      null,
      null,
      null,
      null,
      null
    )
    on conflict (event_key) do update
      set payload = excluded.payload,
          status = 'PENDING',
          attempts = 0,
          last_error = null,
          locked_at = null,
          locked_by = null,
          next_retry_at = null,
          delivered_at = null,
          updated_at = now();
  end if;

  return jsonb_build_object(
    'agreement_id', v_agreement.id,
    'company_id', v_agreement.company_id,
    'status', 'ACTIVE',
    'company_status', v_company_status,
    'receipt', v_now
  );
end
$$;

-- =========================================================
-- 6) Security (RPC execute scope)
-- =========================================================
revoke all on function public.lp_company_register(
  text,
  text,
  text,
  text,
  integer,
  text,
  text
) from public;
revoke all on function public.lp_company_register(
  text,
  text,
  text,
  text,
  integer,
  text,
  text
) from anon;
revoke all on function public.lp_company_register(
  text,
  text,
  text,
  text,
  integer,
  text,
  text
) from authenticated;
grant execute on function public.lp_company_register(
  text,
  text,
  text,
  text,
  integer,
  text,
  text
) to service_role;
grant execute on function public.lp_company_register(
  text,
  text,
  text,
  text,
  integer,
  text,
  text
) to postgres;

revoke all on function public.lp_agreement_approve(uuid) from public;
revoke all on function public.lp_agreement_approve(uuid) from anon;
revoke all on function public.lp_agreement_approve(uuid) from authenticated;
grant execute on function public.lp_agreement_approve(uuid) to service_role;
grant execute on function public.lp_agreement_approve(uuid) to postgres;

commit;

-- Operativ daymap: materialiserer companies.agreement_json.plan.days inn i rader som
-- v_company_current_agreement_daymap leser (én kilde for ansatte/uke/ordre).
-- Trigges fra lp_agreement_create_pending etter INSERT agreements (PENDING).

begin;

create table if not exists public.agreement_day_slot_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  agreement_id uuid not null references public.agreements (id) on delete cascade,
  day_key text not null,
  slot text not null default 'lunch',
  tier public.agreement_tier not null,
  updated_at timestamptz not null default now(),
  constraint agreement_day_slot_rules_day_ck
    check (day_key in ('mon', 'tue', 'wed', 'thu', 'fri')),
  constraint agreement_day_slot_rules_slot_ck
    check (slot = 'lunch'),
  constraint agreement_day_slot_rules_agreement_day_slot_uk unique (agreement_id, day_key, slot)
);

create index if not exists agreement_day_slot_rules_company_id_idx
  on public.agreement_day_slot_rules (company_id);

create index if not exists agreement_day_slot_rules_agreement_id_idx
  on public.agreement_day_slot_rules (agreement_id);

alter table public.agreement_day_slot_rules enable row level security;

drop policy if exists agreement_day_slot_rules_select_own_company on public.agreement_day_slot_rules;
create policy agreement_day_slot_rules_select_own_company
  on public.agreement_day_slot_rules
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.company_id = agreement_day_slot_rules.company_id
        and (p.id = (select auth.uid()) or p.user_id = (select auth.uid()))
    )
  );

drop policy if exists agreement_day_slot_rules_service_role_all on public.agreement_day_slot_rules;
create policy agreement_day_slot_rules_service_role_all
  on public.agreement_day_slot_rules
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.lp_materialize_agreement_day_slots(
  p_company_id uuid,
  p_agreement_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_agreement_company_id uuid;
  v_json jsonb;
  v_days jsonb;
  v_day text;
  v_obj jsonb;
  v_enabled boolean;
  v_tier text;
begin
  if p_company_id is null or p_agreement_id is null then
    return;
  end if;

  select a.company_id into v_agreement_company_id
  from public.agreements a
  where a.id = p_agreement_id;

  if v_agreement_company_id is null or v_agreement_company_id <> p_company_id then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_COMPANY_MISMATCH';
  end if;

  select c.agreement_json into v_json
  from public.companies c
  where c.id = p_company_id;

  delete from public.agreement_day_slot_rules
  where agreement_id = p_agreement_id;

  v_days := coalesce(v_json #> '{plan,days}', '{}'::jsonb);

  foreach v_day in array array['mon', 'tue', 'wed', 'thu', 'fri']::text[] loop
    v_obj := v_days -> v_day;
    if v_obj is null or jsonb_typeof(v_obj) <> 'object' then
      continue;
    end if;

    if v_obj ? 'enabled' then
      v_enabled := coalesce((v_obj ->> 'enabled')::boolean, false);
    elsif v_obj ? 'selected' then
      v_enabled := coalesce((v_obj ->> 'selected')::boolean, false);
    elsif v_obj ? 'active' then
      v_enabled := coalesce((v_obj ->> 'active')::boolean, false);
    else
      v_enabled := true;
    end if;

    if not v_enabled then
      continue;
    end if;

    v_tier := upper(trim(coalesce(v_obj ->> 'tier', v_obj ->> 'plan_tier', '')));
    if v_tier not in ('BASIS', 'LUXUS') then
      continue;
    end if;

    insert into public.agreement_day_slot_rules (
      company_id,
      agreement_id,
      day_key,
      slot,
      tier,
      updated_at
    )
    values (
      p_company_id,
      p_agreement_id,
      v_day,
      'lunch',
      v_tier::public.agreement_tier,
      now()
    );
  end loop;
end;
$$;

revoke all on function public.lp_materialize_agreement_day_slots(uuid, uuid) from public;
revoke all on function public.lp_materialize_agreement_day_slots(uuid, uuid) from anon;
revoke all on function public.lp_materialize_agreement_day_slots(uuid, uuid) from authenticated;
grant execute on function public.lp_materialize_agreement_day_slots(uuid, uuid) to service_role;
grant execute on function public.lp_materialize_agreement_day_slots(uuid, uuid) to postgres;

do $$
declare
  r record;
begin
  for r in
    select a.company_id, a.id as agreement_id
    from public.agreements a
    where a.status in ('PENDING'::public.agreement_status, 'ACTIVE'::public.agreement_status)
  loop
    perform public.lp_materialize_agreement_day_slots(r.company_id, r.agreement_id);
  end loop;
end
$$;

drop view if exists public.v_company_current_agreement_daymap;

create view public.v_company_current_agreement_daymap as
with ranked as (
  select
    a.id as agreement_id,
    a.company_id,
    row_number() over (
      partition by a.company_id
      order by
        case a.status
          when 'ACTIVE'::public.agreement_status then 0
          when 'PENDING'::public.agreement_status then 1
          else 2
        end,
        a.updated_at desc nulls last,
        a.created_at desc
    ) as rn
  from public.agreements a
  where a.status in ('ACTIVE'::public.agreement_status, 'PENDING'::public.agreement_status)
)
select
  r.company_id,
  r.day_key,
  r.tier::text as tier,
  r.slot,
  r.updated_at
from public.agreement_day_slot_rules r
inner join ranked x
  on x.agreement_id = r.agreement_id
 and x.company_id = r.company_id
where x.rn = 1;

grant select on public.v_company_current_agreement_daymap to authenticated;
grant select on public.v_company_current_agreement_daymap to anon;
grant select on public.v_company_current_agreement_daymap to service_role;

drop function if exists public.lp_agreement_create_pending(
  uuid,
  uuid,
  text,
  jsonb,
  time,
  time,
  date,
  integer,
  integer,
  numeric
);

create or replace function public.lp_agreement_create_pending(
  p_company_id uuid,
  p_location_id uuid default null,
  p_tier text default 'BASIS',
  p_delivery_days jsonb default '["mon","tue","wed","thu","fri"]'::jsonb,
  p_slot_start time default time '11:00',
  p_slot_end time default time '13:00',
  p_starts_at date default null,
  p_binding_months integer default 12,
  p_notice_months integer default 3,
  p_price_per_employee numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_company_id uuid;
  v_location_id uuid;
  v_company_status public.company_status;
  v_tier text := upper(trim(coalesce(p_tier, '')));
  v_binding integer := coalesce(p_binding_months, 12);
  v_notice integer := coalesce(p_notice_months, 3);
  v_price numeric := p_price_per_employee;
  v_delivery jsonb := coalesce(p_delivery_days, '[]'::jsonb);
  v_days text[];
  v_agreement_id uuid;
begin
  if p_company_id is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_ID_REQUIRED';
  end if;

  select c.id, c.status
    into v_company_id, v_company_status
  from public.companies c
  where c.id = p_company_id
  for update;

  if v_company_id is null then
    raise exception using errcode = 'P0002', message = 'COMPANY_NOT_FOUND';
  end if;

  if v_company_status = 'CLOSED'::public.company_status then
    raise exception using errcode = 'P0001', message = 'COMPANY_CLOSED';
  end if;

  if exists (
    select 1
    from public.agreements a
    where a.company_id = p_company_id
      and upper(a.status::text) = 'PENDING'
  ) then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_PENDING_EXISTS';
  end if;

  if p_location_id is null then
    select cl.id
      into v_location_id
    from public.company_locations cl
    where cl.company_id = p_company_id
    order by cl.id asc
    limit 1;

    if v_location_id is null then
      raise exception using errcode = 'P0001', message = 'LOCATION_REQUIRED';
    end if;
  else
    select cl.id
      into v_location_id
    from public.company_locations cl
    where cl.id = p_location_id
      and cl.company_id = p_company_id
    limit 1;

    if v_location_id is null then
      raise exception using errcode = 'P0001', message = 'LOCATION_INVALID';
    end if;
  end if;

  if v_tier not in ('BASIS', 'LUXUS') then
    raise exception using errcode = 'P0001', message = 'TIER_INVALID';
  end if;

  if p_starts_at is null then
    raise exception using errcode = 'P0001', message = 'STARTS_AT_REQUIRED';
  end if;

  if p_slot_start is null or p_slot_end is null or p_slot_start >= p_slot_end then
    raise exception using errcode = 'P0001', message = 'SLOT_RANGE_INVALID';
  end if;

  if v_binding <= 0 then
    raise exception using errcode = 'P0001', message = 'BINDING_MONTHS_INVALID';
  end if;

  if v_notice < 0 then
    raise exception using errcode = 'P0001', message = 'NOTICE_MONTHS_INVALID';
  end if;

  if v_price is null or v_price <= 0 then
    raise exception using errcode = 'P0001', message = 'PRICE_PER_EMPLOYEE_INVALID';
  end if;

  if jsonb_typeof(v_delivery) <> 'array' then
    raise exception using errcode = 'P0001', message = 'DELIVERY_DAYS_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_delivery) d(v)
    where lower(trim(d.v)) not in ('mon', 'tue', 'wed', 'thu', 'fri')
  ) then
    raise exception using errcode = 'P0001', message = 'DELIVERY_DAYS_INVALID';
  end if;

  select array_agg(day_key order by ord)
    into v_days
  from (
    select distinct
      case lower(trim(d.v))
        when 'mon' then 'mon'
        when 'tue' then 'tue'
        when 'wed' then 'wed'
        when 'thu' then 'thu'
        when 'fri' then 'fri'
      end as day_key,
      case lower(trim(d.v))
        when 'mon' then 1
        when 'tue' then 2
        when 'wed' then 3
        when 'thu' then 4
        when 'fri' then 5
      end as ord
    from jsonb_array_elements_text(v_delivery) d(v)
  ) x
  where day_key is not null;

  if coalesce(array_length(v_days, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'DELIVERY_DAYS_REQUIRED';
  end if;

  insert into public.agreements (
    company_id,
    location_id,
    tier,
    status,
    delivery_days,
    slot_start,
    slot_end,
    starts_at,
    binding_months,
    notice_months,
    price_per_employee
  )
  values (
    p_company_id,
    v_location_id,
    v_tier::public.agreement_tier,
    'PENDING'::public.agreement_status,
    to_jsonb(v_days),
    p_slot_start,
    p_slot_end,
    p_starts_at,
    v_binding,
    v_notice,
    v_price
  )
  returning id into v_agreement_id;

  perform public.lp_materialize_agreement_day_slots(p_company_id, v_agreement_id);

  return jsonb_build_object(
    'agreement_id', v_agreement_id,
    'company_id', p_company_id,
    'status', 'PENDING'
  );
end;
$$;

revoke all on function public.lp_agreement_create_pending(
  uuid,
  uuid,
  text,
  jsonb,
  time,
  time,
  date,
  integer,
  integer,
  numeric
) from public;
revoke all on function public.lp_agreement_create_pending(
  uuid,
  uuid,
  text,
  jsonb,
  time,
  time,
  date,
  integer,
  integer,
  numeric
) from anon;
revoke all on function public.lp_agreement_create_pending(
  uuid,
  uuid,
  text,
  jsonb,
  time,
  time,
  date,
  integer,
  integer,
  numeric
) from authenticated;
grant execute on function public.lp_agreement_create_pending(
  uuid,
  uuid,
  text,
  jsonb,
  time,
  time,
  date,
  integer,
  integer,
  numeric
) to service_role;
grant execute on function public.lp_agreement_create_pending(
  uuid,
  uuid,
  text,
  jsonb,
  time,
  time,
  date,
  integer,
  integer,
  numeric
) to postgres;

commit;

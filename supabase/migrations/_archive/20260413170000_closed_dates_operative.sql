-- Operativ policy: stengte datoer (eget lag — ikke agreement_json, ikke Sanity).
begin;

create table if not exists public.closed_dates (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  reason text not null default '',
  scope_type text not null,
  scope_id uuid null,
  created_at timestamptz not null default now(),
  constraint closed_dates_scope_type_ck
    check (scope_type in ('global', 'company', 'location')),
  constraint closed_dates_scope_pair_ck
    check (
      (scope_type = 'global' and scope_id is null)
      or (scope_type = 'company' and scope_id is not null)
      or (scope_type = 'location' and scope_id is not null)
    )
);

comment on table public.closed_dates is 'Operativ kalender-sperre (Supabase). Uavhengig av delivery_days / avtaleregler.';

create index if not exists closed_dates_date_idx on public.closed_dates (date);

create unique index if not exists closed_dates_global_uidx
  on public.closed_dates (date)
  where scope_type = 'global';

create unique index if not exists closed_dates_company_uidx
  on public.closed_dates (date, scope_id)
  where scope_type = 'company';

create unique index if not exists closed_dates_location_uidx
  on public.closed_dates (date, scope_id)
  where scope_type = 'location';

alter table public.closed_dates enable row level security;

-- Authenticated: les kun rader som kan gjelde egen profil (global / eget firma / egen lokasjon).
drop policy if exists closed_dates_select_authenticated on public.closed_dates;
create policy closed_dates_select_authenticated
  on public.closed_dates
  for select
  to authenticated
  using (
    (scope_type = 'global' and scope_id is null)
    or (
      scope_type = 'company'
      and scope_id in (
        select p.company_id
        from public.profiles p
        where p.id = auth.uid()
          and p.company_id is not null
      )
    )
    or (
      scope_type = 'location'
      and scope_id in (
        select p.location_id
        from public.profiles p
        where p.id = auth.uid()
          and p.location_id is not null
      )
    )
  );

drop policy if exists closed_dates_service_role_all on public.closed_dates;
create policy closed_dates_service_role_all
  on public.closed_dates
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.closed_dates to authenticated;
grant all on public.closed_dates to service_role;

commit;

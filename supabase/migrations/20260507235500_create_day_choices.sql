-- Employee meal choice per company/location/user/date.
-- Used by kitchen read models to enrich production rows and exclude cancelled choices.

begin;

create table if not exists public.day_choices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  location_id uuid not null references public.company_locations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  choice_key text not null,
  note text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint day_choices_company_location_user_date_key unique (company_id, location_id, user_id, date),
  constraint day_choices_status_ck check (upper(status) in ('ACTIVE', 'CANCELLED'))
);

create index if not exists day_choices_date_idx
  on public.day_choices (date);

create index if not exists day_choices_company_date_idx
  on public.day_choices (company_id, date);

create index if not exists day_choices_user_date_idx
  on public.day_choices (user_id, date);

alter table public.day_choices enable row level security;

revoke all on public.day_choices from public;
revoke all on public.day_choices from anon;
revoke all on public.day_choices from authenticated;
grant select, insert, update, delete on public.day_choices to service_role;

do $$
begin
  if to_regprocedure('public.tg_set_updated_at()') is not null then
    drop trigger if exists day_choices_set_updated_at on public.day_choices;
    create trigger day_choices_set_updated_at
      before update on public.day_choices
      for each row execute function public.tg_set_updated_at();
  end if;
end
$$;

comment on table public.day_choices is
  'Canonical employee meal choice per date. Kitchen excludes rows where latest choice status is CANCELLED.';

commit;

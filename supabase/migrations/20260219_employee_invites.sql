-- supabase/migrations/20260219_employee_invites.sql
-- Employee invites (tenant-bound, fail-closed)

begin;

create extension if not exists pgcrypto;

create table if not exists public.employee_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on update cascade on delete cascade,
  location_id uuid not null references public.company_locations (id) on update cascade on delete restrict,
  email text not null,
  role text not null default 'employee',
  token_hash text not null,
  full_name text null,
  department text null,
  created_by_user_id uuid null,
  created_by_email text null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  last_sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Guard existing installs: required columns must exist before enforcing hard constraints.
do $$
declare
  v_missing text[];
begin
  select array_agg(c) into v_missing
  from (
    select c
    from unnest(array[
      'company_id',
      'location_id',
      'email',
      'role',
      'token_hash',
      'expires_at',
      'used_at',
      'created_at',
      'updated_at'
    ]) as c
    where not exists (
      select 1
      from information_schema.columns ic
      where ic.table_schema = 'public'
        and ic.table_name = 'employee_invites'
        and ic.column_name = c
    )
  ) q;

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'employee_invites missing required columns: %', v_missing;
  end if;
end
$$;

update public.employee_invites
set
  role = coalesce(nullif(btrim(role), ''), 'employee'),
  email = lower(btrim(coalesce(email, '')))
where role is null
   or btrim(coalesce(role, '')) = ''
   or email is null
   or email <> lower(email);

do $$
begin
  if exists (
    select 1
    from public.employee_invites
    where company_id is null
       or location_id is null
       or email is null
       or btrim(coalesce(email, '')) = ''
       or token_hash is null
       or btrim(coalesce(token_hash, '')) = ''
       or expires_at is null
       or created_at is null
  ) then
    raise exception 'employee_invites has null/empty required values; clean data before migration can continue';
  end if;
end
$$;

alter table public.employee_invites
  alter column company_id set not null,
  alter column location_id set not null,
  alter column email set not null,
  alter column role set not null,
  alter column role set default 'employee',
  alter column token_hash set not null,
  alter column expires_at set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.employee_invites
  drop constraint if exists employee_invites_role_ck;

alter table public.employee_invites
  add constraint employee_invites_role_ck
  check (lower(role) = 'employee');

alter table public.employee_invites
  drop constraint if exists employee_invites_expiry_ck;

alter table public.employee_invites
  add constraint employee_invites_expiry_ck
  check (expires_at > created_at);

do $$
begin
  if exists (
    select 1
    from (
      select company_id, lower(email) as email_norm, count(*) as cnt
      from public.employee_invites
      where used_at is null
      group by company_id, lower(email)
      having count(*) > 1
    ) dup
  ) then
    raise exception 'employee_invites has duplicate active invites per company/email; dedupe before unique index';
  end if;

  if exists (
    select 1
    from (
      select token_hash, count(*) as cnt
      from public.employee_invites
      group by token_hash
      having count(*) > 1
    ) dup
  ) then
    raise exception 'employee_invites has duplicate token_hash values; dedupe before unique index';
  end if;
end
$$;

create unique index if not exists employee_invites_token_hash_uniq
  on public.employee_invites (token_hash);

create unique index if not exists employee_invites_active_company_email_uniq
  on public.employee_invites (company_id, lower(email))
  where used_at is null;

create index if not exists employee_invites_company_expires_idx
  on public.employee_invites (company_id, expires_at);

create index if not exists employee_invites_company_location_idx
  on public.employee_invites (company_id, location_id);

create or replace function public.lp_touch_employee_invites_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists employee_invites_set_updated_at on public.employee_invites;
create trigger employee_invites_set_updated_at
before update on public.employee_invites
for each row execute function public.lp_touch_employee_invites_updated_at();

commit;

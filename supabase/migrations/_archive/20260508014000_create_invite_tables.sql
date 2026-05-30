begin;

create extension if not exists pgcrypto;

create table if not exists public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on update cascade on delete cascade,
  code text not null,
  created_by uuid null references auth.users (id) on update cascade on delete set null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on update cascade on delete cascade,
  location_id uuid not null references public.company_locations (id) on update cascade on delete restrict,
  email text not null,
  role text not null default 'employee',
  token_hash text not null,
  full_name text null,
  department text null,
  created_by_user_id uuid null references auth.users (id) on update cascade on delete set null,
  created_by_email text null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  accepted_at timestamptz null,
  last_sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_invites
  drop constraint if exists company_invites_code_not_blank_ck;

alter table public.company_invites
  add constraint company_invites_code_not_blank_ck
  check (btrim(code) <> '');

alter table public.employee_invites
  drop constraint if exists employee_invites_role_ck;

alter table public.employee_invites
  add constraint employee_invites_role_ck
  check (lower(role) = 'employee');

alter table public.employee_invites
  drop constraint if exists employee_invites_email_not_blank_ck;

alter table public.employee_invites
  add constraint employee_invites_email_not_blank_ck
  check (btrim(email) <> '');

alter table public.employee_invites
  drop constraint if exists employee_invites_token_hash_not_blank_ck;

alter table public.employee_invites
  add constraint employee_invites_token_hash_not_blank_ck
  check (btrim(token_hash) <> '');

alter table public.employee_invites
  drop constraint if exists employee_invites_expiry_ck;

alter table public.employee_invites
  add constraint employee_invites_expiry_ck
  check (expires_at > created_at);

create unique index if not exists company_invites_code_uniq
  on public.company_invites (code);

create unique index if not exists company_invites_active_company_uniq
  on public.company_invites (company_id)
  where revoked_at is null;

create index if not exists company_invites_company_created_idx
  on public.company_invites (company_id, created_at desc);

create unique index if not exists employee_invites_token_hash_uniq
  on public.employee_invites (token_hash);

create unique index if not exists employee_invites_active_company_email_uniq
  on public.employee_invites (company_id, lower(email))
  where used_at is null;

create index if not exists employee_invites_company_expires_idx
  on public.employee_invites (company_id, expires_at);

create index if not exists employee_invites_company_location_idx
  on public.employee_invites (company_id, location_id);

create or replace function public.lp_touch_invites_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists company_invites_set_updated_at on public.company_invites;
create trigger company_invites_set_updated_at
before update on public.company_invites
for each row execute function public.lp_touch_invites_updated_at();

drop trigger if exists employee_invites_set_updated_at on public.employee_invites;
create trigger employee_invites_set_updated_at
before update on public.employee_invites
for each row execute function public.lp_touch_invites_updated_at();

alter table public.company_invites enable row level security;
alter table public.employee_invites enable row level security;

revoke all on public.company_invites from anon, authenticated;
revoke all on public.employee_invites from anon, authenticated;
grant all on public.company_invites to service_role;
grant all on public.employee_invites to service_role;

commit;

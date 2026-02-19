-- Bootstrap baseline required for legacy migrations + fail-closed defaults.
-- This migration is intentionally minimal and idempotent.

create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum (
    'employee',
    'company_admin',
    'superadmin',
    'kitchen',
    'driver'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.company_status as enum (
    'PENDING',
    'ACTIVE',
    'PAUSED',
    'CLOSED'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.agreement_status as enum (
    'PENDING',
    'ACTIVE',
    'PAUSED',
    'CLOSED'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.agreement_tier as enum (
    'BASIS',
    'LUXUS'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.order_status as enum (
    'ACTIVE',
    'CANCELED'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  orgnr text,
  name text not null,
  status public.company_status not null default 'PENDING',
  employee_count integer,
  contact_name text,
  contact_email text,
  contact_phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on update cascade on delete cascade,
  name text not null,
  address text,
  slot_policy text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_locations_company_name_uniq unique (company_id, name),
  constraint company_locations_status_ck check (status in ('ACTIVE', 'PAUSED', 'CLOSED'))
);

do $$
begin
  if to_regclass('public.company_locations') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'company_locations_status_ck'
         and conrelid = 'public.company_locations'::regclass
     ) then
    alter table public.company_locations
      add constraint company_locations_status_ck
      check (status in ('ACTIVE', 'PAUSED', 'CLOSED'));
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on update cascade on delete cascade,
  email text,
  full_name text,
  role public.user_role not null default 'employee',
  company_id uuid references public.companies(id) on update cascade on delete set null,
  location_id uuid references public.company_locations(id) on update cascade on delete set null,
  active boolean not null default true,
  disabled_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.profiles
  drop constraint if exists profiles_user_matches_id_ck;

alter table if exists public.profiles
  drop column if exists user_id,
  drop column if exists is_active,
  drop column if exists name;

create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on update cascade on delete cascade,
  location_id uuid not null references public.company_locations(id) on update cascade on delete cascade,
  tier public.agreement_tier not null default 'BASIS',
  status public.agreement_status not null default 'PENDING',
  delivery_days jsonb not null default '["mon","tue","wed","thu","fri"]'::jsonb,
  slot_start time not null default time '11:00',
  slot_end time not null default time '13:00',
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on update cascade on delete cascade,
  date date not null,
  status public.order_status not null default 'ACTIVE',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company_id uuid not null references public.companies(id) on update cascade on delete cascade,
  location_id uuid not null references public.company_locations(id) on update cascade on delete cascade,
  slot text not null default 'default',
  integrity_status text not null default 'ok',
  integrity_reason text,
  integrity_rid text
);

create unique index if not exists orders_user_date_uq
  on public.orders (user_id, date);

create index if not exists orders_company_location_date_idx
  on public.orders (company_id, location_id, date);

do $$
begin
  if to_regclass('public.orders') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'orders_slot_ck'
         and conrelid = 'public.orders'::regclass
     ) then
    alter table public.orders
      add constraint orders_slot_ck
      check (slot in ('default'));
  end if;
end
$$;

create table if not exists public.outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  payload jsonb,
  status text not null default 'PENDING',
  attempts integer not null default 0,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists outbox_event_key_uniq
  on public.outbox (event_key);

create table if not exists public.idempotency (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  key text not null,
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idempotency_scope_key_uq
  on public.idempotency (scope, key);

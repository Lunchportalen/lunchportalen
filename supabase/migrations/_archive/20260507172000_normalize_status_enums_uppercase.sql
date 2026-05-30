-- Normalize public.order_status and public.company_status to uppercase-only labels.
-- Created but not applied to live DB without explicit owner approval.
--
-- WARNING:
-- PostgreSQL cannot drop individual enum labels. To remove lowercase labels, this
-- migration temporarily casts known enum columns to text, recreates the enum
-- types, and casts the columns back. Run only in a controlled migration window.

begin;

-- Preserve constraints/defaults that depend on the enum columns.
alter table public.companies
  alter column status drop default;

alter table public.orders
  alter column status drop default;

alter table public.companies
  drop constraint if exists companies_pending_registration_fields_ck;

-- Convert column data away from lowercase labels before recreating enum types.
alter table public.companies
  alter column status type text
  using upper(status::text);

alter table public.orders
  alter column status type text
  using upper(status::text);

-- Defensive normalization for legacy spelling and empty/null drift before enum cast.
update public.companies
set status = case
  when status in ('', 'NULL') then 'PENDING'
  when status = 'TERMINATED' then 'TERMINATED'
  when status = 'LEAD' then 'LEAD'
  else status
end
where status is null
   or status in ('', 'NULL', 'lead', 'active', 'paused', 'terminated', 'LEAD', 'ACTIVE', 'PAUSED', 'TERMINATED');

update public.orders
set status = case
  when status in ('', 'NULL') then 'ACTIVE'
  when status = 'CANCELED' then 'CANCELLED'
  else status
end
where status is null
   or status in (
     '', 'NULL',
     'draft', 'submitted', 'locked', 'prepared', 'dispatched', 'delivered', 'cancelled', 'canceled',
     'DRAFT', 'SUBMITTED', 'LOCKED', 'PREPARED', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'CANCELED'
   );

-- Recreate enum types without lowercase labels.
alter type public.company_status rename to company_status_legacy_lowercase;
create type public.company_status as enum (
  'LEAD',
  'PENDING',
  'ACTIVE',
  'PAUSED',
  'CLOSED',
  'TERMINATED'
);

alter type public.order_status rename to order_status_legacy_lowercase;
create type public.order_status as enum (
  'DRAFT',
  'SUBMITTED',
  'LOCKED',
  'PREPARED',
  'DISPATCHED',
  'DELIVERED',
  'ACTIVE',
  'CANCELLED'
);

alter table public.companies
  alter column status type public.company_status
  using status::public.company_status,
  alter column status set default 'PENDING'::public.company_status,
  alter column status set not null;

alter table public.orders
  alter column status type public.order_status
  using status::public.order_status,
  alter column status set default 'ACTIVE'::public.order_status,
  alter column status set not null;

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
  );

-- Drop renamed legacy types only if no routines or other objects still depend on them.
-- If this fails, stop and recreate dependent routines against the new canonical types.
drop type public.company_status_legacy_lowercase;
drop type public.order_status_legacy_lowercase;

commit;

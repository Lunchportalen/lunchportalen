begin;

create table if not exists public.company_registrations (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  agreement_id uuid null references public.agreements(id) on delete set null,

  status text not null default 'PENDING',

  orgnr text,
  company_name text,

  submitted_by_email text,
  submitted_by_name text,

  contact_name text,
  contact_email text,
  contact_phone text,

  address_line text,
  postal_code text,
  city text,

  plan_tier text,
  employee_count integer,

  weekday_meal_tiers jsonb,
  delivery_window_from time,
  delivery_window_to time,
  terms_binding_months integer,
  terms_notice_months integer,

  submitted_payload jsonb,
  raw_payload jsonb,

  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  decision_note_internal text,

  approval_email_sent_at timestamptz,
  rejection_message_sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_registrations_company_id_idx
  on public.company_registrations(company_id);

create index if not exists company_registrations_agreement_id_idx
  on public.company_registrations(agreement_id);

create index if not exists company_registrations_status_idx
  on public.company_registrations(status);

create index if not exists company_registrations_created_at_idx
  on public.company_registrations(created_at desc);

alter table public.company_registrations enable row level security;

drop policy if exists company_registrations_superadmin on public.company_registrations;
create policy company_registrations_superadmin on public.company_registrations
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'superadmin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'superadmin'
    )
  );

drop policy if exists company_registrations_service_role_full on public.company_registrations;
create policy company_registrations_service_role_full on public.company_registrations
  for all
  to service_role
  using (true)
  with check (true);

commit;

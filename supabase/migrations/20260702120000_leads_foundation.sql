-- Fase B: canonical pre-customer intake table (leads).
-- Write-path: lp_capture_lead RPC (service_role only). No org/order FK.
-- PII retention: 24m default (documented); delete-RPC + cron = follow-up queue.
-- Idempotent: safe to re-apply on staging/prod.

begin;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  email text not null,
  company text not null,
  source text not null,
  consent_at timestamptz not null,

  phone text null,
  company_size text null,
  message text null,

  status text not null default 'new',
  processed_at timestamptz null,
  created_at timestamptz not null default now(),

  constraint leads_name_len check (char_length(trim(name)) between 1 and 200),
  constraint leads_email_len check (char_length(email) <= 254),
  constraint leads_email_format check (
    email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint leads_company_len check (char_length(trim(company)) between 1 and 300),
  constraint leads_source_len check (char_length(trim(source)) between 1 and 128),
  constraint leads_phone_len check (
    phone is null or char_length(trim(phone)) between 8 and 32
  ),
  constraint leads_company_size_len check (
    company_size is null or char_length(company_size) <= 64
  ),
  constraint leads_message_len check (
    message is null or char_length(message) <= 4000
  ),
  constraint leads_status_check check (
    status in ('new', 'contacted', 'qualified', 'invited', 'closed', 'spam')
  )
);

comment on table public.leads is
  'Canonical pre-customer marketing/sales intake. Not org-bound. PII retention default 24m (policy follow-up).';

create index if not exists leads_created_at_idx
  on public.leads (created_at desc);

create index if not exists leads_email_lower_idx
  on public.leads (lower(trim(email)));

create index if not exists leads_source_created_idx
  on public.leads (source, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: deny-by-default (no anon/authenticated policies)
-- ---------------------------------------------------------------------------
alter table public.leads enable row level security;

drop policy if exists leads_service_role_full on public.leads;
create policy leads_service_role_full
  on public.leads
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.leads from public;
revoke all on table public.leads from anon;
revoke all on table public.leads from authenticated;
grant select, insert, update, delete on table public.leads to service_role;

-- ---------------------------------------------------------------------------
-- Capture RPC (service_role EXECUTE only)
-- ---------------------------------------------------------------------------
create or replace function public.lp_capture_lead(
  p_name text,
  p_email text,
  p_company text,
  p_source text,
  p_consented boolean,
  p_phone text default null,
  p_company_size text default null,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_email text;
  v_company text;
  v_source text;
  v_phone text;
  v_company_size text;
  v_message text;
begin
  if coalesce(p_consented, false) is distinct from true then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;

  v_name := trim(coalesce(p_name, ''));
  v_email := lower(trim(coalesce(p_email, '')));
  v_company := trim(coalesce(p_company, ''));
  v_source := trim(coalesce(p_source, ''));
  v_phone := nullif(trim(coalesce(p_phone, '')), '');
  v_company_size := nullif(trim(coalesce(p_company_size, '')), '');
  v_message := nullif(trim(coalesce(p_message, '')), '');

  if char_length(v_name) < 1 or char_length(v_name) > 200 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;

  if char_length(v_email) < 1
     or char_length(v_email) > 254
     or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;

  if char_length(v_company) < 1 or char_length(v_company) > 300 then
    raise exception 'invalid_company' using errcode = 'P0001';
  end if;

  if char_length(v_source) < 1 or char_length(v_source) > 128 then
    raise exception 'invalid_source' using errcode = 'P0001';
  end if;

  if v_phone is not null and (char_length(v_phone) < 8 or char_length(v_phone) > 32) then
    raise exception 'invalid_phone' using errcode = 'P0001';
  end if;

  if v_company_size is not null and char_length(v_company_size) > 64 then
    raise exception 'invalid_company_size' using errcode = 'P0001';
  end if;

  if v_message is not null and char_length(v_message) > 4000 then
    raise exception 'invalid_message' using errcode = 'P0001';
  end if;

  insert into public.leads (
    name,
    email,
    company,
    source,
    consent_at,
    phone,
    company_size,
    message
  )
  values (
    v_name,
    v_email,
    v_company,
    v_source,
    now(),
    v_phone,
    v_company_size,
    v_message
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.lp_capture_lead(
  text, text, text, text, boolean, text, text, text
) is
  'Canonical lead capture. Requires p_consented=true; sets consent_at server-side. service_role only.';

revoke all on function public.lp_capture_lead(
  text, text, text, text, boolean, text, text, text
) from public;

revoke all on function public.lp_capture_lead(
  text, text, text, text, boolean, text, text, text
) from anon;

revoke all on function public.lp_capture_lead(
  text, text, text, text, boolean, text, text, text
) from authenticated;

grant execute on function public.lp_capture_lead(
  text, text, text, text, boolean, text, text, text
) to service_role;

commit;

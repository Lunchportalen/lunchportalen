-- Geography-first intake: postal/city on leads + coverage wish signal.
-- Extends lp_capture_lead (backward-compatible optional params).

begin;

alter table public.leads
  add column if not exists postal_code text null,
  add column if not exists city text null,
  add column if not exists region text null,
  add column if not exists coverage_wish boolean not null default false,
  add column if not exists lead_type text not null default 'customer';

alter table public.leads
  drop constraint if exists leads_postal_code_format;

alter table public.leads
  add constraint leads_postal_code_format check (
    postal_code is null
    or postal_code ~ '^\d{4}$'
  );

alter table public.leads
  drop constraint if exists leads_city_len;

alter table public.leads
  add constraint leads_city_len check (
    city is null
    or char_length(trim(city)) between 1 and 128
  );

alter table public.leads
  drop constraint if exists leads_region_len;

alter table public.leads
  add constraint leads_region_len check (
    region is null
    or char_length(region) <= 64
  );

alter table public.leads
  drop constraint if exists leads_lead_type_check;

alter table public.leads
  add constraint leads_lead_type_check check (
    lead_type in ('customer', 'provider')
  );

comment on column public.leads.postal_code is 'Norwegian 4-digit postal code from geography gate.';
comment on column public.leads.city is 'City/postal place from geography gate.';
comment on column public.leads.coverage_wish is 'True when customer requested coverage in an uncovered area.';
comment on column public.leads.lead_type is 'customer | provider — intake segment.';

create index if not exists leads_postal_code_created_idx
  on public.leads (postal_code, created_at desc)
  where postal_code is not null;

create index if not exists leads_coverage_wish_created_idx
  on public.leads (created_at desc)
  where coverage_wish = true;

-- Drop old 8-arg overload signature grants before replace (same name, extended args).
drop function if exists public.lp_capture_lead(
  text, text, text, text, boolean, text, text, text
);

create or replace function public.lp_capture_lead(
  p_name text,
  p_email text,
  p_company text,
  p_source text,
  p_consented boolean,
  p_phone text default null,
  p_company_size text default null,
  p_message text default null,
  p_postal_code text default null,
  p_city text default null,
  p_region text default null,
  p_coverage_wish boolean default false,
  p_lead_type text default 'customer'
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
  v_postal_code text;
  v_city text;
  v_region text;
  v_lead_type text;
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
  v_postal_code := nullif(regexp_replace(trim(coalesce(p_postal_code, '')), '\D', '', 'g'), '');
  v_city := nullif(trim(coalesce(p_city, '')), '');
  v_region := nullif(trim(coalesce(p_region, '')), '');
  v_lead_type := lower(trim(coalesce(p_lead_type, 'customer')));

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

  if v_postal_code is not null and v_postal_code !~ '^\d{4}$' then
    raise exception 'invalid_postal_code' using errcode = 'P0001';
  end if;

  if v_city is not null and (char_length(v_city) < 1 or char_length(v_city) > 128) then
    raise exception 'invalid_city' using errcode = 'P0001';
  end if;

  if v_region is not null and char_length(v_region) > 64 then
    raise exception 'invalid_region' using errcode = 'P0001';
  end if;

  if v_lead_type not in ('customer', 'provider') then
    raise exception 'invalid_lead_type' using errcode = 'P0001';
  end if;

  insert into public.leads (
    name,
    email,
    company,
    source,
    consent_at,
    phone,
    company_size,
    message,
    postal_code,
    city,
    region,
    coverage_wish,
    lead_type
  )
  values (
    v_name,
    v_email,
    v_company,
    v_source,
    now(),
    v_phone,
    v_company_size,
    v_message,
    v_postal_code,
    v_city,
    v_region,
    coalesce(p_coverage_wish, false),
    v_lead_type
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.lp_capture_lead(
  text, text, text, text, boolean, text, text, text, text, text, text, boolean, text
) is
  'Canonical lead capture with optional geography + coverage wish. service_role only.';

revoke all on function public.lp_capture_lead(
  text, text, text, text, boolean, text, text, text, text, text, text, boolean, text
) from public;

revoke all on function public.lp_capture_lead(
  text, text, text, text, boolean, text, text, text, text, text, text, boolean, text
) from anon;

revoke all on function public.lp_capture_lead(
  text, text, text, text, boolean, text, text, text, text, text, text, boolean, text
) from authenticated;

grant execute on function public.lp_capture_lead(
  text, text, text, text, boolean, text, text, text, text, text, text, boolean, text
) to service_role;

commit;

-- 20260222_domain_hardening_core.sql
-- Narrow, backward-safe constraints for core domain entities.
-- Scope:
-- - companies.orgnr format (9 digits, optional)
-- - agreements.delivery_days structure (array, mon–fri / 1–5 only)

begin;

-- ======================================================================
-- 1) companies.orgnr — 9 digit organization number (optional)
--    Business rule is already enforced in lp_company_register:
--    - orgnr is normalized to digits-only and length must be 9.
--    We add a NOT VALID check so existing bad rows do not block deploy.
-- ======================================================================

do $$
begin
  if to_regclass('public.companies') is null then
    raise notice 'table public.companies missing, skipping companies_orgnr_format_ck';
    return;
  end if;

  begin
    alter table public.companies
      add constraint companies_orgnr_format_ck
      check (
        orgnr is null
        or orgnr ~ '^[0-9]{9}$'
      ) not valid;
  exception
    when duplicate_object then
      -- Constraint already exists; nothing to do.
      null;
  end;
end
$$;

-- ======================================================================
-- 2) agreements.delivery_days — array of Mon–Fri only
--    Business rule is enforced in lp_agreement_create_pending:
--    - delivery_days must be an array
--    - all elements map to Mon–Fri (by name or ISO dow number 1–5)
--    This constraint mirrors that logic at table level for new writes.
--    We keep it NOT VALID for backward compatibility.
-- ======================================================================

do $$
begin
  if to_regclass('public.agreements') is null then
    raise notice 'table public.agreements missing, skipping agreements_delivery_days_ck';
    return;
  end if;

  begin
    alter table public.agreements
      add constraint agreements_delivery_days_ck
      check (
        jsonb_typeof(delivery_days) = 'array'
        and not exists (
          select 1
          from jsonb_array_elements_text(delivery_days) as d(v)
          where lower(trim(d.v)) not in ('mon', 'tue', 'wed', 'thu', 'fri', '1', '2', '3', '4', '5')
        )
      ) not valid;
  exception
    when duplicate_object then
      -- Constraint already exists; nothing to do.
      null;
  end;
end
$$;

commit;


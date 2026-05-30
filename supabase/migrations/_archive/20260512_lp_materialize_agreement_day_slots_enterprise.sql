-- Oppdater lp_materialize_agreement_day_slots til å materialisere ENTERPRISE.
-- Replikerer eksisterende funksjon med utvidet tier-whitelist.
-- Se 20260414220000_agreement_day_slot_rules_daymap.sql for original definisjon.

create or replace function public.lp_materialize_agreement_day_slots(
  p_company_id uuid,
  p_agreement_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_agreement_company_id uuid;
  v_json jsonb;
  v_days jsonb;
  v_day text;
  v_obj jsonb;
  v_enabled boolean;
  v_tier text;
begin
  if p_company_id is null or p_agreement_id is null then
    return;
  end if;

  select a.company_id into v_agreement_company_id
  from public.agreements a
  where a.id = p_agreement_id;

  if v_agreement_company_id is null or v_agreement_company_id <> p_company_id then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_COMPANY_MISMATCH';
  end if;

  select c.agreement_json into v_json
  from public.companies c
  where c.id = p_company_id;

  delete from public.agreement_day_slot_rules
  where agreement_id = p_agreement_id;

  v_days := coalesce(v_json #> '{plan,days}', '{}'::jsonb);

  foreach v_day in array array['mon', 'tue', 'wed', 'thu', 'fri']::text[] loop
    v_obj := v_days -> v_day;
    if v_obj is null or jsonb_typeof(v_obj) <> 'object' then
      continue;
    end if;

    if v_obj ? 'enabled' then
      v_enabled := coalesce((v_obj ->> 'enabled')::boolean, false);
    elsif v_obj ? 'selected' then
      v_enabled := coalesce((v_obj ->> 'selected')::boolean, false);
    elsif v_obj ? 'active' then
      v_enabled := coalesce((v_obj ->> 'active')::boolean, false);
    else
      v_enabled := true;
    end if;

    if not v_enabled then
      continue;
    end if;

    v_tier := upper(trim(coalesce(v_obj ->> 'tier', v_obj ->> 'plan_tier', '')));
    if v_tier not in ('BASIS', 'LUXUS', 'ENTERPRISE') then
      continue;
    end if;

    insert into public.agreement_day_slot_rules (
      company_id,
      agreement_id,
      day_key,
      slot,
      tier,
      updated_at
    )
    values (
      p_company_id,
      p_agreement_id,
      v_day,
      'lunch',
      v_tier::public.agreement_tier,
      now()
    );
  end loop;
end;
$$;

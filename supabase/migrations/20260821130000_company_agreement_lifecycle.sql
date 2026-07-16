-- PHASE 5 (part 2/2): company onboarding + agreement lifecycle (additive).
--
-- Adds:
--   1) company_locations delivery fields (contact/window/instructions).
--   2) companies.cost_center + invoice_reference (billing profile).
--   3) lp_match_providers_by_postal_code — ALL covering providers (deterministic).
--   4) lp_company_register with explicit provider choice:
--        - no coverage           → PROVIDER_NOT_FOUND (fail-closed, no rows)
--        - exactly one provider  → auto-assigned
--        - multiple providers    → PROVIDER_CHOICE_REQUIRED unless a valid
--                                  p_provider_id from the matched set is given
--        - p_provider_id outside matched set → PROVIDER_NOT_ELIGIBLE
--   5) Agreement state machine RPCs: suspend / resume / terminate
--      (PENDING→ACTIVE via existing lp_agreement_approve_active is unchanged).
--   6) lp_agreement_materialize_plan — copies registration plan (weekday tiers,
--      delivery window, binding/notice) onto the agreement at approval.
--
-- All RPCs: SECURITY DEFINER + pinned search_path. Grants: transitions and
-- materialization are service_role only; lp_company_register keeps its current
-- authenticated + service_role grants (anon stays revoked per Phase 1 lockdown).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) company_locations: delivery contact, window and instructions (additive).
-- ---------------------------------------------------------------------------
ALTER TABLE public.company_locations
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS window_from text,
  ADD COLUMN IF NOT EXISTS window_to text,
  ADD COLUMN IF NOT EXISTS delivery_instructions text;

COMMENT ON COLUMN public.company_locations.delivery_instructions IS
  'Free-text delivery instructions shown to provider/driver (door codes, floor, dock).';

-- ---------------------------------------------------------------------------
-- 2) companies: billing profile fields (additive).
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cost_center text,
  ADD COLUMN IF NOT EXISTS invoice_reference text;

COMMENT ON COLUMN public.companies.cost_center IS
  'Company-level default cost center printed on invoices (per-employee override lives on company_memberships.cost_center).';
COMMENT ON COLUMN public.companies.invoice_reference IS
  'Buyer reference / PO shown on invoices (fakturareferanse).';

-- ---------------------------------------------------------------------------
-- 3) All covering providers for a postal code (deterministic order).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_match_providers_by_postal_code(p_postal_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_pc text := regexp_replace(coalesce(p_postal_code, ''), '\D', '', 'g');
  v_out jsonb;
BEGIN
  IF length(v_pc) <> 4 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('provider_id', t.provider_id, 'name', t.name)), '[]'::jsonb)
  INTO v_out
  FROM (
    SELECT DISTINCT psa.provider_id, p.name
    FROM public.provider_service_areas psa
    JOIN public.providers p ON p.id = psa.provider_id
    WHERE psa.active = true
      AND p.status = 'ACTIVE'
      AND p.deleted_at IS NULL
      AND regexp_replace(coalesce(psa.postal_code_from, ''), '\D', '', 'g') <> ''
      AND regexp_replace(coalesce(psa.postal_code_to, ''), '\D', '', 'g') <> ''
      AND regexp_replace(psa.postal_code_from, '\D', '', 'g') <= v_pc
      AND regexp_replace(psa.postal_code_to, '\D', '', 'g') >= v_pc
    ORDER BY psa.provider_id ASC
  ) t;

  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.lp_match_providers_by_postal_code(text) IS
  'Fase 5: all ACTIVE providers covering a 4-digit postal code, ordered by provider_id (deterministic). Used for controlled provider choice.';

-- ---------------------------------------------------------------------------
-- 4) lp_company_register with explicit provider choice.
--    Signature change (additive optional param) → drop + recreate + re-grant.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.lp_company_register(text, text, integer, text, text, text, text, text, text);

CREATE FUNCTION public.lp_company_register(
  p_company_name text,
  p_orgnr text,
  p_employee_count integer,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_address_line text,
  p_postal_code text,
  p_postal_city text,
  p_provider_id uuid DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_company_id uuid;
  v_location_id uuid;
  v_agreement_id uuid;
  v_registration_id uuid;
  v_provider_id uuid;
  v_matches jsonb;
  v_match_count int;

  v_orgnr text := regexp_replace(coalesce(p_orgnr, ''), '\D', '', 'g');
  v_company_name text := nullif(btrim(coalesce(p_company_name, '')), '');
  v_contact_name text := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_contact_email text := lower(nullif(btrim(coalesce(p_contact_email, '')), ''));
  v_contact_phone text := regexp_replace(coalesce(p_contact_phone, ''), '\D', '', 'g');
  v_address_line text := nullif(btrim(coalesce(p_address_line, '')), '');
  v_postal_code text := regexp_replace(coalesce(p_postal_code, ''), '\D', '', 'g');
  v_postal_city text := nullif(btrim(coalesce(p_postal_city, '')), '');
  v_full_address text;
begin
  if length(v_orgnr) <> 9 then
    raise exception 'ORGNR_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('lp_company_register'),
    hashtext(v_orgnr)
  );

  if v_company_name is null then
    raise exception 'COMPANY_NAME_REQUIRED';
  end if;

  if p_employee_count is null or p_employee_count < 20 then
    raise exception 'EMPLOYEE_COUNT_MIN_20';
  end if;

  if v_contact_name is null then
    raise exception 'CONTACT_NAME_REQUIRED';
  end if;

  if v_contact_email is null
    or v_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'CONTACT_EMAIL_INVALID';
  end if;

  if v_contact_phone is null or v_contact_phone = '' then
    raise exception 'CONTACT_PHONE_REQUIRED';
  end if;

  if v_address_line is null then
    raise exception 'ADDRESS_LINE_REQUIRED';
  end if;

  if length(v_postal_code) <> 4 then
    raise exception 'POSTAL_CODE_INVALID';
  end if;

  if v_postal_city is null then
    raise exception 'POSTAL_CITY_REQUIRED';
  end if;

  if exists (
    select 1
    from public.companies c
    where c.deleted_at is null
      and c.status in (
        'PENDING'::public.company_status,
        'ACTIVE'::public.company_status
      )
      and (
        btrim(coalesce(c.orgnr, '')) = v_orgnr
        or btrim(coalesce(c.organization_number, '')) = v_orgnr
      )
  ) then
    raise exception 'ORGNR_ALREADY_REGISTERED';
  end if;

  if exists (
    select 1
    from public.company_registrations cr
    where cr.orgnr = v_orgnr
      and cr.created_at >= now() - interval '24 hours'
  ) then
    raise exception 'ORGNR_RECENT_REGISTRATION_EXISTS';
  end if;

  -- Provider matching on ACTUAL coverage (fail-closed, server-side only).
  --   0 matches  → PROVIDER_NOT_FOUND (no rows written)
  --   1 match    → auto-assign
  --   >1 matches → caller must supply a p_provider_id from the matched set
  --                (controlled choice); anything else → fail-closed.
  v_matches := public.lp_match_providers_by_postal_code(v_postal_code);
  v_match_count := jsonb_array_length(coalesce(v_matches, '[]'::jsonb));

  if v_match_count = 0 then
    raise exception 'PROVIDER_NOT_FOUND';
  end if;

  if p_provider_id is not null then
    if not exists (
      select 1 from jsonb_array_elements(v_matches) e
      where (e->>'provider_id')::uuid = p_provider_id
    ) then
      raise exception 'PROVIDER_NOT_ELIGIBLE';
    end if;
    v_provider_id := p_provider_id;
  elsif v_match_count = 1 then
    v_provider_id := (v_matches->0->>'provider_id')::uuid;
  else
    raise exception 'PROVIDER_CHOICE_REQUIRED';
  end if;

  v_full_address := trim(both ' ' from (
    v_address_line || ', ' || v_postal_code || ' ' || v_postal_city
  ));

  insert into public.companies (
    name, orgnr, organization_number, status, employee_count,
    contact_name, contact_email, contact_phone, address, provider_id
  )
  values (
    v_company_name, v_orgnr, v_orgnr, 'PENDING'::public.company_status, p_employee_count,
    v_contact_name, v_contact_email, v_contact_phone, v_full_address, v_provider_id
  )
  returning id into v_company_id;

  insert into public.company_locations (company_id, name, address)
  values (v_company_id, 'Hovedlokasjon', v_full_address)
  returning id into v_location_id;

  update public.companies
  set default_location_id = v_location_id,
      updated_at = now()
  where id = v_company_id;

  insert into public.agreements (
    company_id, location_id, status, submitted_by_email, submitted_by_name,
    comment_from_company, provider_id
  )
  values (
    v_company_id, v_location_id, 'PENDING'::public.agreement_status,
    v_contact_email, v_contact_name,
    'Innsendt via offentlig firmaregistrering.', v_provider_id
  )
  returning id into v_agreement_id;

  insert into public.company_registrations (
    company_id, agreement_id, status, orgnr, company_name,
    submitted_by_email, submitted_by_name, contact_name, contact_email, contact_phone,
    address_line, postal_code, city, employee_count, provider_id,
    submitted_payload, raw_payload
  )
  values (
    v_company_id, v_agreement_id, 'PENDING', v_orgnr, v_company_name,
    v_contact_email, v_contact_name, v_contact_name, v_contact_email, v_contact_phone,
    v_address_line, v_postal_code, v_postal_city, p_employee_count, v_provider_id,
    jsonb_build_object(
      'orgnr', v_orgnr,
      'company_name', v_company_name,
      'employee_count', p_employee_count,
      'contact_name', v_contact_name,
      'contact_email', v_contact_email,
      'contact_phone', v_contact_phone,
      'address_line', v_address_line,
      'postal_code', v_postal_code,
      'postal_city', v_postal_city,
      'provider_id', v_provider_id,
      'provider_match_count', v_match_count,
      'provider_chosen_explicitly', p_provider_id is not null
    ),
    jsonb_build_object(
      'p_orgnr', p_orgnr,
      'p_company_name', p_company_name,
      'p_employee_count', p_employee_count,
      'p_contact_name', p_contact_name,
      'p_contact_email', p_contact_email,
      'p_contact_phone', p_contact_phone,
      'p_address_line', p_address_line,
      'p_postal_code', p_postal_code,
      'p_postal_city', p_postal_city,
      'p_provider_id', p_provider_id
    )
  )
  returning id into v_registration_id;

  insert into public.audit_events (
    action, entity_type, entity_id, company_id, location_id,
    actor_email, actor_role, summary, detail, scope, metadata
  )
  values (
    'company_registration_submitted', 'company_registration', v_registration_id::text,
    v_company_id, v_location_id, v_contact_email, 'public',
    'Firma registrerte avtaleforespørsel.',
    jsonb_build_object(
      'company_id', v_company_id, 'agreement_id', v_agreement_id,
      'registration_id', v_registration_id, 'orgnr', v_orgnr,
      'provider_id', v_provider_id, 'provider_match_count', v_match_count
    ),
    'superadmin',
    jsonb_build_object(
      'company_id', v_company_id, 'agreement_id', v_agreement_id,
      'registration_id', v_registration_id, 'orgnr', v_orgnr,
      'provider_id', v_provider_id, 'source', 'public_register_company'
    )
  );

  return json_build_object(
    'company_id', v_company_id,
    'status', 'PENDING',
    'provider_id', v_provider_id,
    'receipt', json_build_object('message', 'Registreringen er mottatt.')
  );
end;
$$;

COMMENT ON FUNCTION public.lp_company_register(text, text, integer, text, text, text, text, text, text, uuid) IS
  'Fase 5: public company registration with fail-closed provider matching and controlled provider choice when multiple providers cover the postal code.';

-- ---------------------------------------------------------------------------
-- 5) Agreement state machine: suspend / resume / terminate.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_agreement_suspend(
  p_agreement_id uuid,
  p_actor_user_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_agreement public.agreements%rowtype;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_agreement FROM public.agreements WHERE id = p_agreement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AGREEMENT_NOT_FOUND' USING errcode = 'P0002'; END IF;
  IF upper(v_agreement.status::text) = 'SUSPENDED' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'agreement_id', p_agreement_id, 'status', 'SUSPENDED');
  END IF;
  IF upper(v_agreement.status::text) <> 'ACTIVE' THEN
    RAISE EXCEPTION 'AGREEMENT_NOT_ACTIVE' USING errcode = 'P0001';
  END IF;

  UPDATE public.agreements
  SET status = 'SUSPENDED'::public.agreement_status, updated_at = v_now
  WHERE id = p_agreement_id;

  UPDATE public.companies
  SET status = 'PAUSED'::public.company_status,
      suspended_at = v_now,
      suspended_by = p_actor_user_id,
      suspended_reason = nullif(btrim(coalesce(p_reason, '')), ''),
      updated_at = v_now
  WHERE id = v_agreement.company_id;

  INSERT INTO public.audit_events (action, entity_type, entity_id, company_id, actor_user_id, actor_role, summary, detail, scope)
  VALUES ('agreement_suspended', 'agreement', p_agreement_id::text, v_agreement.company_id, p_actor_user_id, 'superadmin',
          'Avtale suspendert.', jsonb_build_object('reason', p_reason, 'previous_status', v_agreement.status::text), 'superadmin');

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'agreement_id', p_agreement_id, 'status', 'SUSPENDED');
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_agreement_resume(
  p_agreement_id uuid,
  p_actor_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_agreement public.agreements%rowtype;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_agreement FROM public.agreements WHERE id = p_agreement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AGREEMENT_NOT_FOUND' USING errcode = 'P0002'; END IF;
  IF upper(v_agreement.status::text) = 'ACTIVE' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'agreement_id', p_agreement_id, 'status', 'ACTIVE');
  END IF;
  IF upper(v_agreement.status::text) <> 'SUSPENDED' THEN
    RAISE EXCEPTION 'AGREEMENT_NOT_SUSPENDED' USING errcode = 'P0001';
  END IF;

  UPDATE public.agreements
  SET status = 'ACTIVE'::public.agreement_status, updated_at = v_now
  WHERE id = p_agreement_id;

  UPDATE public.companies
  SET status = 'ACTIVE'::public.company_status,
      suspended_at = NULL,
      suspended_by = NULL,
      suspended_reason = NULL,
      updated_at = v_now
  WHERE id = v_agreement.company_id;

  INSERT INTO public.audit_events (action, entity_type, entity_id, company_id, actor_user_id, actor_role, summary, detail, scope)
  VALUES ('agreement_resumed', 'agreement', p_agreement_id::text, v_agreement.company_id, p_actor_user_id, 'superadmin',
          'Avtale gjenopptatt.', jsonb_build_object('previous_status', v_agreement.status::text), 'superadmin');

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'agreement_id', p_agreement_id, 'status', 'ACTIVE');
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_agreement_terminate(
  p_agreement_id uuid,
  p_actor_user_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_agreement public.agreements%rowtype;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_agreement FROM public.agreements WHERE id = p_agreement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AGREEMENT_NOT_FOUND' USING errcode = 'P0002'; END IF;
  IF upper(v_agreement.status::text) = 'TERMINATED' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'agreement_id', p_agreement_id, 'status', 'TERMINATED');
  END IF;
  IF upper(v_agreement.status::text) NOT IN ('ACTIVE', 'SUSPENDED') THEN
    RAISE EXCEPTION 'AGREEMENT_NOT_TERMINABLE' USING errcode = 'P0001';
  END IF;

  UPDATE public.agreements
  SET status = 'TERMINATED'::public.agreement_status,
      ends_at = coalesce(ends_at, current_date),
      updated_at = v_now
  WHERE id = p_agreement_id;

  UPDATE public.companies
  SET status = 'TERMINATED'::public.company_status,
      updated_at = v_now
  WHERE id = v_agreement.company_id;

  INSERT INTO public.audit_events (action, entity_type, entity_id, company_id, actor_user_id, actor_role, summary, detail, scope)
  VALUES ('agreement_terminated', 'agreement', p_agreement_id::text, v_agreement.company_id, p_actor_user_id, 'superadmin',
          'Avtale terminert.', jsonb_build_object('reason', p_reason, 'previous_status', v_agreement.status::text), 'superadmin');

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'agreement_id', p_agreement_id, 'status', 'TERMINATED');
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Materialize registration plan onto the agreement (at approval).
--    Idempotent: safe to re-run; skips cleanly when the registration carries
--    no plan (materialized:false) — never guesses (fail-closed, no defaults).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_agreement_materialize_plan(p_agreement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_agreement public.agreements%rowtype;
  v_reg public.company_registrations%rowtype;
  v_tiers jsonb;
  v_day text;
  v_tier text;
  v_days jsonb := '[]'::jsonb;
  v_top_tier text := 'BASIS';
BEGIN
  SELECT * INTO v_agreement FROM public.agreements WHERE id = p_agreement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AGREEMENT_NOT_FOUND' USING errcode = 'P0002'; END IF;

  SELECT * INTO v_reg
  FROM public.company_registrations
  WHERE company_id = v_agreement.company_id
  ORDER BY CASE WHEN agreement_id = v_agreement.id THEN 0 ELSE 1 END, created_at DESC, id DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'materialized', false, 'reason', 'NO_REGISTRATION');
  END IF;

  v_tiers := v_reg.weekday_meal_tiers;
  IF v_tiers IS NULL OR jsonb_typeof(v_tiers) <> 'object' THEN
    RETURN jsonb_build_object('ok', true, 'materialized', false, 'reason', 'NO_PLAN');
  END IF;

  -- Collect valid days + dominant tier first.
  FOR v_day IN SELECT unnest(ARRAY['mon','tue','wed','thu','fri']) LOOP
    v_tier := upper(coalesce(v_tiers->>v_day, ''));
    IF v_tier IN ('BASIS', 'LUXUS', 'ENTERPRISE') THEN
      v_days := v_days || to_jsonb(v_day);
      IF v_tier = 'ENTERPRISE' THEN
        v_top_tier := 'ENTERPRISE';
      ELSIF v_tier = 'LUXUS' AND v_top_tier <> 'ENTERPRISE' THEN
        v_top_tier := 'LUXUS';
      END IF;
    END IF;
  END LOOP;

  IF jsonb_array_length(v_days) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'materialized', false, 'reason', 'NO_VALID_DAYS');
  END IF;

  -- Update the agreement FIRST: trg_agreements_sync_delivery_days wipes and
  -- regenerates agreement_delivery_days from delivery_days (without tiers),
  -- so per-day tiers must be written AFTER this statement.
  UPDATE public.agreements
  SET delivery_days = v_days,
      tier = v_top_tier::public.agreement_tier,
      slot_start = coalesce(nullif(btrim(coalesce(v_reg.delivery_window_from::text, '')), '')::time, slot_start),
      slot_end = coalesce(nullif(btrim(coalesce(v_reg.delivery_window_to::text, '')), '')::time, slot_end),
      binding_months = coalesce(v_reg.terms_binding_months, binding_months),
      notice_months = coalesce(v_reg.terms_notice_months, notice_months),
      updated_at = now()
  WHERE id = p_agreement_id;

  -- Per-day tiers → agreement_delivery_days (after the sync trigger ran).
  FOR v_day IN SELECT unnest(ARRAY['mon','tue','wed','thu','fri']) LOOP
    v_tier := upper(coalesce(v_tiers->>v_day, ''));
    IF v_tier IN ('BASIS', 'LUXUS', 'ENTERPRISE') THEN
      INSERT INTO public.agreement_delivery_days (agreement_id, weekday, tier)
      VALUES (p_agreement_id, v_day, v_tier::public.agreement_tier)
      ON CONFLICT (agreement_id, weekday) DO UPDATE SET tier = excluded.tier;
    END IF;
  END LOOP;

  INSERT INTO public.audit_events (action, entity_type, entity_id, company_id, actor_role, summary, detail, scope)
  VALUES ('agreement_plan_materialized', 'agreement', p_agreement_id::text, v_agreement.company_id, 'system',
          'Registreringsplan materialisert på avtalen.',
          jsonb_build_object('delivery_days', v_days, 'tier', v_top_tier, 'registration_id', v_reg.id), 'superadmin');

  RETURN jsonb_build_object('ok', true, 'materialized', true, 'agreement_id', p_agreement_id, 'delivery_days', v_days, 'tier', v_top_tier);
END;
$$;

COMMENT ON FUNCTION public.lp_agreement_materialize_plan(uuid) IS
  'Fase 5: copies weekday tiers, delivery window and binding/notice terms from the registration onto the agreement (+agreement_delivery_days). Idempotent; skips when no plan.';

-- ---------------------------------------------------------------------------
-- 7) Grants (Phase 1 anon lockdown preserved).
-- ---------------------------------------------------------------------------
-- NB: Supabase default privileges grant anon EXECUTE on new functions —
-- explicit REVOKE FROM anon required to preserve the Phase 1 lockdown.
REVOKE ALL ON FUNCTION public.lp_match_providers_by_postal_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lp_match_providers_by_postal_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.lp_match_providers_by_postal_code(text) TO authenticated, service_role, postgres;

REVOKE ALL ON FUNCTION public.lp_company_register(text, text, integer, text, text, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lp_company_register(text, text, integer, text, text, text, text, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.lp_company_register(text, text, integer, text, text, text, text, text, text, uuid) TO authenticated, service_role, postgres;

REVOKE ALL ON FUNCTION public.lp_agreement_suspend(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lp_agreement_suspend(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lp_agreement_suspend(uuid, uuid, text) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.lp_agreement_resume(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lp_agreement_resume(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lp_agreement_resume(uuid, uuid) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.lp_agreement_terminate(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lp_agreement_terminate(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lp_agreement_terminate(uuid, uuid, text) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.lp_agreement_materialize_plan(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lp_agreement_materialize_plan(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lp_agreement_materialize_plan(uuid) TO service_role, postgres;

COMMIT;

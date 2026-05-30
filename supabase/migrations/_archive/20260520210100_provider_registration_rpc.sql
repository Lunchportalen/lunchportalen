-- Patch 13 (Phase E.13) — provider registration matching + intake + approval RPCs

CREATE OR REPLACE FUNCTION public.lp_match_provider_by_postal_code(p_postal_code text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_pc text := regexp_replace(btrim(coalesce(p_postal_code, '')), '\D', '', 'g');
  v_provider_id uuid;
BEGIN
  IF length(v_pc) <> 4 THEN
    RETURN NULL;
  END IF;

  SELECT psa.provider_id
    INTO v_provider_id
  FROM public.provider_service_areas psa
  INNER JOIN public.providers p ON p.id = psa.provider_id
  WHERE psa.active = true
    AND p.status = 'ACTIVE'::public.provider_status
    AND p.deleted_at IS NULL
    AND regexp_replace(btrim(coalesce(psa.postal_code_from, '')), '\D', '', 'g') <= v_pc
    AND regexp_replace(btrim(coalesce(psa.postal_code_to, '')), '\D', '', 'g') >= v_pc
  ORDER BY psa.provider_id ASC
  LIMIT 1;

  RETURN v_provider_id;
END;
$$;

COMMENT ON FUNCTION public.lp_match_provider_by_postal_code(text) IS
'Deterministic provider match: first active service area covering postal code (asc provider_id).';

GRANT EXECUTE ON FUNCTION public.lp_match_provider_by_postal_code(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.lp_company_registration_create(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_company_name text := btrim(coalesce(p_payload ->> 'company_name', ''));
  v_orgnr text := regexp_replace(btrim(coalesce(p_payload ->> 'org_number', p_payload ->> 'orgnr', '')), '\D', '', 'g');
  v_contact_name text := btrim(coalesce(p_payload ->> 'contact_name', ''));
  v_contact_email text := lower(btrim(coalesce(p_payload ->> 'contact_email', '')));
  v_contact_phone text;
  v_postal_code text := regexp_replace(btrim(coalesce(p_payload ->> 'postal_code', '')), '\D', '', 'g');
  v_city text := btrim(coalesce(p_payload ->> 'city', ''));
  v_employees int;
  v_notes text := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
  v_address_line text := btrim(coalesce(p_payload ->> 'address_line', ''));
  v_provider_id uuid;
  v_provider_name text;
  v_registration_id uuid;
  v_submitted jsonb;
  v_raw jsonb;
BEGIN
  IF v_company_name = '' THEN
    RAISE EXCEPTION 'COMPANY_NAME_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF length(v_orgnr) <> 9 THEN
    RAISE EXCEPTION 'ORGNR_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF v_contact_name = '' THEN
    RAISE EXCEPTION 'CONTACT_NAME_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF v_contact_email = '' OR v_contact_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'CONTACT_EMAIL_INVALID' USING ERRCODE = 'P0001';
  END IF;

  v_contact_phone := regexp_replace(btrim(coalesce(p_payload ->> 'contact_phone', '')), '\D', '', 'g');
  IF length(v_contact_phone) < 8 THEN
    RAISE EXCEPTION 'CONTACT_PHONE_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF length(v_postal_code) <> 4 THEN
    RAISE EXCEPTION 'POSTAL_CODE_INVALID' USING ERRCODE = 'P0001';
  END IF;

  IF v_city = '' THEN
    RAISE EXCEPTION 'CITY_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  v_employees := (p_payload ->> 'employees_estimate')::int;
  IF v_employees IS NULL THEN
    v_employees := (p_payload ->> 'employee_count')::int;
  END IF;
  IF v_employees IS NULL OR v_employees < 20 THEN
    RAISE EXCEPTION 'EMPLOYEE_COUNT_MIN_20' USING ERRCODE = 'P0001';
  END IF;

  IF v_address_line = '' THEN
    v_address_line := v_city || ' ' || v_postal_code;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.deleted_at IS NULL
      AND (
        btrim(coalesce(c.orgnr, '')) = v_orgnr
        OR btrim(coalesce(c.organization_number, '')) = v_orgnr
      )
      AND c.status <> 'PENDING'::public.company_status
  ) THEN
    RAISE EXCEPTION 'ORGNR_ALREADY_REGISTERED' USING ERRCODE = 'P0001';
  END IF;

  v_provider_id := public.lp_match_provider_by_postal_code(v_postal_code);

  IF v_provider_id IS NOT NULL THEN
    SELECT p.name INTO v_provider_name FROM public.providers p WHERE p.id = v_provider_id;
  END IF;

  v_submitted := jsonb_build_object(
    'source', 'provider_registration_intake',
    'company_name', v_company_name,
    'orgnr', v_orgnr,
    'contact_name', v_contact_name,
    'contact_email', v_contact_email,
    'contact_phone', v_contact_phone,
    'postal_code', v_postal_code,
    'city', v_city,
    'employee_count', v_employees,
    'notes', v_notes,
    'expand_my_area', v_provider_id IS NULL
  );

  v_raw := coalesce(p_payload, '{}'::jsonb);

  INSERT INTO public.company_registrations (
    company_id,
    status,
    orgnr,
    company_name,
    submitted_by_email,
    submitted_by_name,
    contact_name,
    contact_email,
    contact_phone,
    address_line,
    postal_code,
    city,
    employee_count,
    provider_id,
    requested_postal_code,
    requested_city,
    submitted_payload,
    raw_payload
  )
  VALUES (
    NULL,
    'PENDING',
    v_orgnr,
    v_company_name,
    v_contact_email,
    v_contact_name,
    v_contact_name,
    v_contact_email,
    v_contact_phone,
    v_address_line,
    v_postal_code,
    v_city,
    v_employees,
    v_provider_id,
    v_postal_code,
    v_city,
    v_submitted,
    v_raw
  )
  RETURNING id INTO v_registration_id;

  INSERT INTO public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  VALUES (
    NULL,
    'company_registration_intake',
    'company_registration',
    v_registration_id,
    NULL,
    jsonb_build_object(
      'provider_id', v_provider_id,
      'postal_code', v_postal_code,
      'expand_my_area', v_provider_id IS NULL
    )
  );

  IF v_provider_id IS NOT NULL THEN
    INSERT INTO public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
    VALUES (
      NULL,
      'registration_provider_notify_stub',
      'provider',
      v_provider_id,
      'Provider admin notification stub (Patch 13)',
      jsonb_build_object('registration_id', v_registration_id, 'contact_email', v_contact_email)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'registration_id', v_registration_id,
    'matched_provider_id', v_provider_id,
    'matched_provider_name', v_provider_name,
    'expand_my_area', v_provider_id IS NULL,
    'message', CASE
      WHEN v_provider_id IS NOT NULL THEN 'Registrering mottatt. Leverandor er varslet.'
      ELSE 'Registrering mottatt. Vi dekker ikke omradet enna, men har notert interessen.'
    END
  );
END;
$$;

COMMENT ON FUNCTION public.lp_company_registration_create(jsonb) IS
'Public provider intake: match postal code, insert PENDING registration (no company until approval).';

GRANT EXECUTE ON FUNCTION public.lp_company_registration_create(jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.lp_assert_registration_approve_access(p_registration_id uuid)
RETURNS public.company_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_reg public.company_registrations%rowtype;
BEGIN
  SELECT * INTO v_reg
  FROM public.company_registrations
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REGISTRATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF public.is_platform_admin() THEN
    RETURN v_reg;
  END IF;

  IF v_reg.provider_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.provider_memberships pm
       WHERE pm.user_id = auth.uid()
         AND pm.provider_id = v_reg.provider_id
         AND pm.role = 'provider_admin'::public.provider_role
     ) THEN
    RETURN v_reg;
  END IF;

  IF v_reg.provider_id IS NULL THEN
    IF public.is_platform_admin() THEN
      RETURN v_reg;
    END IF;
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_company_registration_approve_provider(
  p_registration_id uuid,
  p_agreement_tier text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_reg public.company_registrations%rowtype;
  v_tier text := upper(btrim(coalesce(p_agreement_tier, '')));
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_location_id uuid;
  v_agreement_id uuid;
  v_invite_id uuid;
  v_token_hash text;
  v_now timestamptz := now();
  v_weekday_tiers jsonb;
  v_delivery_days text[] := ARRAY['mon','tue','wed','thu','fri'];
  v_day text;
  v_slot_start time := time '11:00';
  v_slot_end time := time '13:00';
  v_binding int := 12;
  v_notice int := 3;
  v_full_address text;
  v_agreement_json jsonb;
  v_existing_company uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF v_tier NOT IN ('BASIS', 'LUXUS') THEN
    RAISE EXCEPTION 'AGREEMENT_TIER_INVALID' USING ERRCODE = 'P0001';
  END IF;

  v_reg := private.lp_assert_registration_approve_access(p_registration_id);

  IF upper(coalesce(v_reg.status, '')) <> 'PENDING' THEN
    RAISE EXCEPTION 'REGISTRATION_NOT_PENDING' USING ERRCODE = 'P0001';
  END IF;

  v_weekday_tiers := jsonb_build_object(
    'mon', v_tier,
    'tue', v_tier,
    'wed', v_tier,
    'thu', v_tier,
    'fri', v_tier
  );

  v_company_id := v_reg.company_id;

  IF v_company_id IS NULL THEN
    SELECT c.id INTO v_existing_company
    FROM public.companies c
    WHERE c.deleted_at IS NULL
      AND (
        btrim(coalesce(c.orgnr, '')) = btrim(coalesce(v_reg.orgnr, ''))
        OR btrim(coalesce(c.organization_number, '')) = btrim(coalesce(v_reg.orgnr, ''))
      )
    LIMIT 1
    FOR UPDATE;

    IF v_existing_company IS NOT NULL THEN
      v_company_id := v_existing_company;
    ELSE
      INSERT INTO public.companies (name, orgnr, organization_number, status, provider_id)
      VALUES (
        coalesce(v_reg.company_name, 'Ny bedrift'),
        v_reg.orgnr,
        v_reg.orgnr,
        'PENDING'::public.company_status,
        v_reg.provider_id
      )
      RETURNING id INTO v_company_id;
    END IF;

    v_full_address := trim(both ' ' from coalesce(v_reg.address_line, '') || ', ' ||
      coalesce(v_reg.postal_code, '') || ' ' || coalesce(v_reg.city, ''));

    SELECT cl.id INTO v_location_id
    FROM public.company_locations cl
    WHERE cl.company_id = v_company_id
      AND cl.name = coalesce(v_reg.company_name, 'Hovedkontor')
    LIMIT 1;

    IF v_location_id IS NULL THEN
      INSERT INTO public.company_locations (company_id, name, address, status)
      VALUES (v_company_id, coalesce(v_reg.company_name, 'Hovedkontor'), nullif(v_full_address, ''), 'ACTIVE')
      RETURNING id INTO v_location_id;
    ELSE
      UPDATE public.company_locations
         SET address = nullif(v_full_address, ''),
             updated_at = v_now
       WHERE id = v_location_id;
    END IF;

    UPDATE public.companies
       SET default_location_id = coalesce(default_location_id, v_location_id),
           updated_at = v_now
     WHERE id = v_company_id;
  ELSE
    SELECT cl.id INTO v_location_id
    FROM public.company_locations cl
    WHERE cl.company_id = v_company_id
    ORDER BY cl.created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF v_location_id IS NULL THEN
      RAISE EXCEPTION 'COMPANY_LOCATION_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_reg.provider_id IS NOT NULL THEN
    UPDATE public.companies SET provider_id = v_reg.provider_id, updated_at = v_now WHERE id = v_company_id;
  END IF;

  v_agreement_json := jsonb_build_object(
    'version', 1,
    'source', 'company_registration_approve_provider',
    'registration_id', v_reg.id,
    'company_id', v_company_id,
    'created_at', v_now,
    'plan', jsonb_build_object(
      'days', jsonb_build_object(
        'mon', jsonb_build_object('enabled', true, 'tier', v_tier),
        'tue', jsonb_build_object('enabled', true, 'tier', v_tier),
        'wed', jsonb_build_object('enabled', true, 'tier', v_tier),
        'thu', jsonb_build_object('enabled', true, 'tier', v_tier),
        'fri', jsonb_build_object('enabled', true, 'tier', v_tier)
      )
    )
  );

  UPDATE public.companies
     SET status = 'ACTIVE'::public.company_status,
         agreement_json = v_agreement_json,
         updated_at = v_now
   WHERE id = v_company_id;

  INSERT INTO public.agreements (
    company_id,
    location_id,
    provider_id,
    tier,
    status,
    delivery_days,
    slot_start,
    slot_end,
    starts_at,
    start_date,
    binding_months,
    notice_months,
    submitted_by_email,
    submitted_by_name,
    reviewed_by,
    reviewed_at,
    approved_at,
    activated_at,
    comment_from_company
  )
  VALUES (
    v_company_id,
    v_location_id,
    v_reg.provider_id,
    v_tier::public.agreement_tier,
    'ACTIVE'::public.agreement_status,
    to_jsonb(v_delivery_days),
    v_slot_start,
    v_slot_end,
    current_date,
    current_date,
    v_binding,
    v_notice,
    coalesce(v_reg.contact_email, v_reg.submitted_by_email),
    coalesce(v_reg.contact_name, v_reg.submitted_by_name),
    v_actor,
    v_now,
    v_now,
    v_now,
    'Godkjent fra provider-registreringsko (Patch 13).'
  )
  RETURNING id INTO v_agreement_id;

  UPDATE public.company_registrations
     SET status = 'APPROVED',
         company_id = v_company_id,
         plan_tier = v_tier,
         weekday_meal_tiers = v_weekday_tiers,
         reviewed_at = v_now,
         reviewed_by = v_actor,
         agreement_id = v_agreement_id,
         updated_at = v_now
   WHERE id = v_reg.id;

  IF to_regprocedure('public.lp_materialize_agreement_day_slots(uuid,uuid)') IS NOT NULL THEN
    PERFORM public.lp_materialize_agreement_day_slots(v_company_id, v_agreement_id);
  END IF;

  v_token_hash := encode(digest(
    gen_random_uuid()::text || ':' || clock_timestamp()::text || ':' || v_company_id::text,
    'sha256'
  ), 'hex');

  INSERT INTO public.company_invites (
    company_id,
    email,
    contact_email,
    contact_name,
    role,
    token_hash,
    expires_at
  )
  VALUES (
    v_company_id,
    coalesce(v_reg.contact_email, v_reg.submitted_by_email),
    coalesce(v_reg.contact_email, v_reg.submitted_by_email),
    coalesce(v_reg.contact_name, v_reg.submitted_by_name),
    'company_admin',
    v_token_hash,
    v_now + interval '7 days'
  )
  RETURNING id INTO v_invite_id;

  INSERT INTO public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  VALUES (
    v_actor,
    'company_registration_approved',
    'company_registration',
    v_reg.id,
    NULL,
    jsonb_build_object(
      'company_id', v_company_id,
      'agreement_id', v_agreement_id,
      'tier', v_tier,
      'provider_id', v_reg.provider_id
    )
  );

  INSERT INTO public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  VALUES (
    v_actor,
    'registration_approval_email_stub',
    'company_registration',
    v_reg.id,
    'Invite email stub (Patch 13)',
    jsonb_build_object('invite_id', v_invite_id, 'contact_email', v_reg.contact_email)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'company_id', v_company_id,
    'agreement_id', v_agreement_id,
    'invite_id', v_invite_id,
    'status', 'APPROVED'
  );
END;
$$;

COMMENT ON FUNCTION public.lp_company_registration_approve_provider(uuid, text) IS
'Provider admin / superadmin: approve intake registration -> company + agreement + invite.';

GRANT EXECUTE ON FUNCTION public.lp_company_registration_approve_provider(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.lp_company_registration_reject_provider(
  p_registration_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_reg public.company_registrations%rowtype;
  v_actor uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_now timestamptz := now();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  v_reg := private.lp_assert_registration_approve_access(p_registration_id);

  IF upper(coalesce(v_reg.status, '')) <> 'PENDING' THEN
    RAISE EXCEPTION 'REGISTRATION_NOT_PENDING' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.company_registrations
     SET status = 'REJECTED',
         reviewed_at = v_now,
         reviewed_by = v_actor,
         rejection_reason = v_reason,
         updated_at = v_now
   WHERE id = v_reg.id;

  INSERT INTO public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  VALUES (
    v_actor,
    'company_registration_rejected',
    'company_registration',
    v_reg.id,
    v_reason,
    jsonb_build_object('provider_id', v_reg.provider_id)
  );

  RETURN jsonb_build_object('ok', true, 'status', 'REJECTED');
END;
$$;

GRANT EXECUTE ON FUNCTION public.lp_company_registration_reject_provider(uuid, text) TO authenticated;

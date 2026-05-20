-- Patch 14 (Phase E.14) — provider_admin service areas CRUD + overlap-safe RPCs

GRANT SELECT, INSERT, UPDATE ON public.provider_service_areas TO authenticated;

DROP POLICY IF EXISTS service_areas_select_admin ON public.provider_service_areas;
CREATE POLICY service_areas_select_admin ON public.provider_service_areas
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_access_provider(provider_id));

DROP POLICY IF EXISTS service_areas_insert_admin ON public.provider_service_areas;
CREATE POLICY service_areas_insert_admin ON public.provider_service_areas
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.provider_id = provider_service_areas.provider_id
        AND pm.role = 'provider_admin'::public.provider_role
    )
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS service_areas_update_admin ON public.provider_service_areas;
CREATE POLICY service_areas_update_admin ON public.provider_service_areas
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.provider_id = provider_service_areas.provider_id
        AND pm.role = 'provider_admin'::public.provider_role
    )
    OR public.is_platform_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.provider_id = provider_service_areas.provider_id
        AND pm.role = 'provider_admin'::public.provider_role
    )
    OR public.is_platform_admin()
  );

CREATE OR REPLACE FUNCTION public.lp_service_area_save(
  p_id uuid,
  p_provider_id uuid,
  p_city text,
  p_postal_code_from text,
  p_postal_code_to text,
  p_min_employees int,
  p_max_employees int,
  p_available_days text[],
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_from text := regexp_replace(btrim(coalesce(p_postal_code_from, '')), '\D', '', 'g');
  v_to text := regexp_replace(btrim(coalesce(p_postal_code_to, '')), '\D', '', 'g');
  v_city text := btrim(coalesce(p_city, ''));
  v_active boolean := coalesce(p_active, true);
  v_overlap_city text;
  v_overlap_from text;
  v_overlap_to text;
  v_audit_action text;
  v_saved_id uuid;
  v_days text[];
BEGIN
  IF NOT public.is_platform_admin()
     AND NOT EXISTS (
       SELECT 1
       FROM public.provider_memberships pm
       WHERE pm.user_id = auth.uid()
         AND pm.provider_id = p_provider_id
         AND pm.role = 'provider_admin'::public.provider_role
     ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_city = '' THEN
    RAISE EXCEPTION 'CITY_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF length(v_from) <> 4 OR length(v_to) <> 4 THEN
    RAISE EXCEPTION 'POSTAL_CODE_FORMAT_INVALID' USING ERRCODE = '22023';
  END IF;

  IF v_from > v_to THEN
    RAISE EXCEPTION 'POSTAL_RANGE_INVALID' USING ERRCODE = '22023';
  END IF;

  IF p_min_employees IS NOT NULL AND p_max_employees IS NOT NULL AND p_min_employees > p_max_employees THEN
    RAISE EXCEPTION 'EMPLOYEE_RANGE_INVALID' USING ERRCODE = 'P0001';
  END IF;

  v_days := coalesce(p_available_days, ARRAY['mon','tue','wed','thu','fri']::text[]);

  IF v_active THEN
    SELECT psa.city, psa.postal_code_from, psa.postal_code_to
      INTO v_overlap_city, v_overlap_from, v_overlap_to
    FROM public.provider_service_areas psa
    WHERE psa.provider_id = p_provider_id
      AND (p_id IS NULL OR psa.id <> p_id)
      AND psa.active = true
      AND NOT (
        psa.postal_code_to < v_from
        OR psa.postal_code_from > v_to
      )
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION '%',
        format(
          'POSTAL_RANGE_OVERLAPS_EXISTING:%s:%s-%s',
          coalesce(v_overlap_city, 'omrade'),
          coalesce(v_overlap_from, '?'),
          coalesce(v_overlap_to, '?')
        )
        USING ERRCODE = '23505';
    END IF;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.provider_service_areas (
      provider_id,
      country,
      city,
      postal_code_from,
      postal_code_to,
      min_employees,
      max_employees,
      available_days,
      active
    )
    VALUES (
      p_provider_id,
      'NO',
      v_city,
      v_from,
      v_to,
      p_min_employees,
      p_max_employees,
      v_days,
      v_active
    )
    RETURNING id INTO v_saved_id;
    v_audit_action := 'service_area_create';
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.provider_service_areas psa
      WHERE psa.id = p_id AND psa.provider_id = p_provider_id
    ) THEN
      RAISE EXCEPTION 'SERVICE_AREA_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.provider_service_areas
       SET city = v_city,
           postal_code_from = v_from,
           postal_code_to = v_to,
           min_employees = p_min_employees,
           max_employees = p_max_employees,
           available_days = v_days,
           active = v_active
     WHERE id = p_id
       AND provider_id = p_provider_id;

    v_saved_id := p_id;
    v_audit_action := 'service_area_update';
  END IF;

  INSERT INTO public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  VALUES (
    auth.uid(),
    v_audit_action,
    'service_area',
    v_saved_id,
    format('Service area %s for %s-%s', v_audit_action, v_from, v_to),
    jsonb_build_object(
      'provider_id', p_provider_id,
      'city', v_city,
      'active', v_active,
      'postal_code_from', v_from,
      'postal_code_to', v_to
    )
  );

  RETURN jsonb_build_object('ok', true, 'id', v_saved_id);
END;
$$;

COMMENT ON FUNCTION public.lp_service_area_save(uuid, uuid, text, text, text, int, int, text[], boolean) IS
'Provider admin: create/update service area with overlap detection among active ranges.';

GRANT EXECUTE ON FUNCTION public.lp_service_area_save(
  uuid, uuid, text, text, text, int, int, text[], boolean
) TO authenticated;

CREATE OR REPLACE FUNCTION public.lp_service_area_toggle_active(
  p_id uuid,
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_row public.provider_service_areas%rowtype;
  v_active boolean := coalesce(p_active, false);
  v_overlap_city text;
  v_overlap_from text;
  v_overlap_to text;
BEGIN
  SELECT * INTO v_row
  FROM public.provider_service_areas
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_AREA_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_platform_admin()
     AND NOT EXISTS (
       SELECT 1
       FROM public.provider_memberships pm
       WHERE pm.user_id = auth.uid()
         AND pm.provider_id = v_row.provider_id
         AND pm.role = 'provider_admin'::public.provider_role
     ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_active THEN
    SELECT psa.city, psa.postal_code_from, psa.postal_code_to
      INTO v_overlap_city, v_overlap_from, v_overlap_to
    FROM public.provider_service_areas psa
    WHERE psa.provider_id = v_row.provider_id
      AND psa.id <> p_id
      AND psa.active = true
      AND NOT (
        psa.postal_code_to < v_row.postal_code_from
        OR psa.postal_code_from > v_row.postal_code_to
      )
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION '%',
        format(
          'POSTAL_RANGE_OVERLAPS_EXISTING:%s:%s-%s',
          coalesce(v_overlap_city, 'omrade'),
          coalesce(v_overlap_from, '?'),
          coalesce(v_overlap_to, '?')
        )
        USING ERRCODE = '23505';
    END IF;
  END IF;

  UPDATE public.provider_service_areas
     SET active = v_active
   WHERE id = p_id;

  INSERT INTO public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  VALUES (
    auth.uid(),
    'service_area_toggle',
    'service_area',
    p_id,
    format('Service area active=%s', v_active),
    jsonb_build_object(
      'provider_id', v_row.provider_id,
      'city', v_row.city,
      'active', v_active,
      'postal_code_from', v_row.postal_code_from,
      'postal_code_to', v_row.postal_code_to
    )
  );

  RETURN jsonb_build_object('ok', true, 'id', p_id, 'active', v_active);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lp_service_area_toggle_active(uuid, boolean) TO authenticated;

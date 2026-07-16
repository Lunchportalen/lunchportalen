-- PROVIDER SELF-SERVICE REGISTRATION & BOOTSTRAP (Fase 4, additive).
--
-- Adds the missing cateringfirma (provider) lifecycle that previously only
-- existed via the Phase C operator CLI:
--   public registration → PENDING application → superadmin review →
--   approval (atomic provider org bootstrap) / rejection →
--   first provider_admin invite token → acceptance → provider dashboard.
--
-- Mirrors the company_registrations state machine. All 21 canonical country
-- markets supported. US/CA require an explicit provider timezone.
--
-- Fail-closed everywhere; no implicit Melhus/default fallback; a provider can
-- never become a customer of itself. Sanity mapping is NOT published here
-- (handled draft-only in the approval API layer).
--
-- RLS: new tables are service-role only (RPC-mediated). Grants: anon EXECUTE
-- only on lp_provider_registration_create (the single public entry point);
-- everything else is service_role. SECURITY DEFINER + pinned search_path.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) provider_settings: add invoice language + tax registration (additive).
-- ---------------------------------------------------------------------------
ALTER TABLE public.provider_settings
  ADD COLUMN IF NOT EXISTS invoice_language text,
  ADD COLUMN IF NOT EXISTS tax_registration text,
  ADD COLUMN IF NOT EXISTS invoice_details jsonb;

COMMENT ON COLUMN public.provider_settings.invoice_language IS
  'Invoice/document language (app locale code). Seeded from the approved registration; distinct from operating locale.';
COMMENT ON COLUMN public.provider_settings.tax_registration IS
  'Provider tax/VAT registration identifier for the market. Seeded from the approved registration.';

-- ---------------------------------------------------------------------------
-- 2) provider_registrations — PENDING → APPROVED/REJECTED state machine.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'PENDING',

  -- Company identity
  company_name text NOT NULL,
  org_number text,
  country_code text NOT NULL,

  -- Contact / first admin
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,

  -- Commercial/operational intent (seed provider_settings on approval)
  operating_language text NOT NULL,
  invoice_language text NOT NULL,
  currency text NOT NULL,
  timezone text,                       -- REQUIRED for US/CA (provider_required markets)
  tax_registration text,
  invoice_details jsonb,
  order_email text,
  kitchen_email text,
  delivery_email text,
  coverage_wish text,
  cutoff_local_time time NOT NULL DEFAULT time '08:00',

  -- Review
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  decision_note_internal text,
  approval_email_sent_at timestamptz,
  rejection_message_sent_at timestamptz,

  submitted_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT provider_registrations_status_ck
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT provider_registrations_country_ck
    CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT provider_registrations_email_ck
    CHECK (position('@' in contact_email) > 1)
);

-- One live PENDING application per org_number / contact_email (dedup backbone).
CREATE UNIQUE INDEX IF NOT EXISTS provider_registrations_pending_org_uidx
  ON public.provider_registrations (lower(org_number))
  WHERE status = 'PENDING' AND org_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS provider_registrations_pending_email_uidx
  ON public.provider_registrations (lower(contact_email))
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS provider_registrations_status_idx
  ON public.provider_registrations (status, created_at DESC);

ALTER TABLE public.provider_registrations ENABLE ROW LEVEL SECURITY;
-- Service-role only (RPC-mediated). No anon/authenticated policies by design.

-- updated_at touch
DROP TRIGGER IF EXISTS provider_registrations_set_updated_at ON public.provider_registrations;
CREATE TRIGGER provider_registrations_set_updated_at
  BEFORE UPDATE ON public.provider_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3) provider_invites — first provider_admin invite token (hashed, TTL).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.provider_role NOT NULL DEFAULT 'provider_admin',
  token_hash text NOT NULL,
  full_name text,
  registration_id uuid REFERENCES public.provider_registrations(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_invites_expiry_ck CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_invites_token_hash_uidx
  ON public.provider_invites (token_hash);
CREATE INDEX IF NOT EXISTS provider_invites_provider_idx
  ON public.provider_invites (provider_id);

ALTER TABLE public.provider_invites ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS provider_invites_set_updated_at ON public.provider_invites;
CREATE TRIGGER provider_invites_set_updated_at
  BEFORE UPDATE ON public.provider_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) RPC: public provider registration (anon, fail-closed, dedup).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_provider_registration_create(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_country text := upper(trim(coalesce(p_payload->>'country_code', '')));
  v_email text := lower(trim(coalesce(p_payload->>'contact_email', '')));
  v_org text := nullif(trim(coalesce(p_payload->>'org_number', '')), '');
  v_name text := trim(coalesce(p_payload->>'company_name', ''));
  v_tz text := nullif(trim(coalesce(p_payload->>'timezone', '')), '');
  v_id uuid;
BEGIN
  IF v_name = '' THEN RAISE EXCEPTION 'COMPANY_NAME_REQUIRED' USING errcode = 'P0001'; END IF;
  IF v_country !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'COUNTRY_REQUIRED' USING errcode = 'P0001'; END IF;
  IF position('@' in v_email) <= 1 THEN RAISE EXCEPTION 'CONTACT_EMAIL_INVALID' USING errcode = 'P0001'; END IF;
  IF trim(coalesce(p_payload->>'contact_name', '')) = '' THEN RAISE EXCEPTION 'CONTACT_NAME_REQUIRED' USING errcode = 'P0001'; END IF;
  IF trim(coalesce(p_payload->>'operating_language', '')) = '' THEN RAISE EXCEPTION 'OPERATING_LANGUAGE_REQUIRED' USING errcode = 'P0001'; END IF;
  IF trim(coalesce(p_payload->>'invoice_language', '')) = '' THEN RAISE EXCEPTION 'INVOICE_LANGUAGE_REQUIRED' USING errcode = 'P0001'; END IF;
  IF trim(coalesce(p_payload->>'currency', '')) = '' THEN RAISE EXCEPTION 'CURRENCY_REQUIRED' USING errcode = 'P0001'; END IF;

  -- US/CA are provider_required timezone markets: a timezone is mandatory.
  IF v_country IN ('US', 'CA') AND v_tz IS NULL THEN
    RAISE EXCEPTION 'TIMEZONE_REQUIRED_FOR_MARKET' USING errcode = 'P0001';
  END IF;

  -- Duplicate protection: never over an existing ACTIVE/known provider.
  IF v_org IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.providers WHERE lower(coalesce(org_number, '')) = lower(v_org)
  ) THEN
    RAISE EXCEPTION 'ORG_NUMBER_ALREADY_PROVIDER' USING errcode = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.providers WHERE lower(coalesce(contact_email, '')) = v_email) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_PROVIDER' USING errcode = 'P0001';
  END IF;
  -- One live PENDING per org/email (also enforced by partial unique indexes).
  IF v_org IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.provider_registrations
    WHERE status = 'PENDING' AND lower(coalesce(org_number, '')) = lower(v_org)
  ) THEN
    RAISE EXCEPTION 'PENDING_REGISTRATION_EXISTS' USING errcode = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.provider_registrations
    WHERE status = 'PENDING' AND lower(contact_email) = v_email
  ) THEN
    RAISE EXCEPTION 'PENDING_REGISTRATION_EXISTS' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.provider_registrations (
    status, company_name, org_number, country_code,
    contact_name, contact_email, contact_phone,
    operating_language, invoice_language, currency, timezone, tax_registration,
    invoice_details, order_email, kitchen_email, delivery_email, coverage_wish,
    cutoff_local_time, submitted_payload
  ) VALUES (
    'PENDING', v_name, v_org, v_country,
    trim(p_payload->>'contact_name'), v_email, nullif(trim(coalesce(p_payload->>'contact_phone', '')), ''),
    trim(p_payload->>'operating_language'), trim(p_payload->>'invoice_language'),
    upper(trim(p_payload->>'currency')), v_tz, nullif(trim(coalesce(p_payload->>'tax_registration', '')), ''),
    CASE WHEN jsonb_typeof(p_payload->'invoice_details') = 'object' THEN p_payload->'invoice_details' ELSE NULL END,
    nullif(trim(coalesce(p_payload->>'order_email', '')), ''),
    nullif(trim(coalesce(p_payload->>'kitchen_email', '')), ''),
    nullif(trim(coalesce(p_payload->>'delivery_email', '')), ''),
    nullif(trim(coalesce(p_payload->>'coverage_wish', '')), ''),
    coalesce(nullif(trim(coalesce(p_payload->>'cutoff_local_time', '')), '')::time, time '08:00'),
    p_payload
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'registration_id', v_id, 'status', 'PENDING');
END;
$$;

COMMENT ON FUNCTION public.lp_provider_registration_create(jsonb) IS
  'Fase 4 public provider self-service registration. Fail-closed validation + dedup; inserts a PENDING provider_registration. anon-executable.';

-- ---------------------------------------------------------------------------
-- 5) RPC: superadmin reject.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_provider_registration_reject(
  p_registration_id uuid,
  p_reason text,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_reg public.provider_registrations%rowtype;
BEGIN
  SELECT * INTO v_reg FROM public.provider_registrations WHERE id = p_registration_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REGISTRATION_NOT_FOUND' USING errcode = 'P0001'; END IF;
  IF v_reg.status <> 'PENDING' THEN RAISE EXCEPTION 'REGISTRATION_NOT_PENDING' USING errcode = 'P0001'; END IF;

  UPDATE public.provider_registrations
  SET status = 'REJECTED',
      reviewed_by = p_actor_user_id,
      reviewed_at = now(),
      decision_note_internal = nullif(trim(coalesce(p_reason, '')), ''),
      updated_at = now()
  WHERE id = p_registration_id;

  RETURN jsonb_build_object('ok', true, 'registration_id', p_registration_id, 'status', 'REJECTED');
END;
$$;

COMMENT ON FUNCTION public.lp_provider_registration_reject(uuid, text, uuid) IS
  'Fase 4 superadmin reject of a PENDING provider registration. service_role only.';

-- ---------------------------------------------------------------------------
-- 6) RPC: superadmin approve — ATOMIC provider org bootstrap.
--    Creates providers + organizations + provider_settings + provider_invite
--    in one transaction. No company/agreement is created (a provider is never
--    a customer of itself). Caller supplies slug + hashed invite token.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_provider_registration_approve(
  p_registration_id uuid,
  p_slug text,
  p_token_hash text,
  p_invite_expires_at timestamptz,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_reg public.provider_registrations%rowtype;
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_provider_id uuid;
  v_invite_id uuid;
BEGIN
  IF v_slug = '' THEN RAISE EXCEPTION 'SLUG_REQUIRED' USING errcode = 'P0001'; END IF;
  IF coalesce(trim(p_token_hash), '') = '' THEN RAISE EXCEPTION 'TOKEN_REQUIRED' USING errcode = 'P0001'; END IF;

  SELECT * INTO v_reg FROM public.provider_registrations WHERE id = p_registration_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REGISTRATION_NOT_FOUND' USING errcode = 'P0001'; END IF;

  -- Idempotency: already approved with a provider → return existing.
  IF v_reg.status = 'APPROVED' AND v_reg.provider_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'provider_id', v_reg.provider_id, 'status', 'APPROVED');
  END IF;
  IF v_reg.status <> 'PENDING' THEN RAISE EXCEPTION 'REGISTRATION_NOT_PENDING' USING errcode = 'P0001'; END IF;

  -- Re-check duplicates at approval time (fail-closed).
  IF EXISTS (SELECT 1 FROM public.providers WHERE slug = v_slug) THEN
    RAISE EXCEPTION 'SLUG_ALREADY_EXISTS' USING errcode = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.providers WHERE name = v_reg.company_name) THEN
    RAISE EXCEPTION 'NAME_ALREADY_EXISTS' USING errcode = 'P0001';
  END IF;
  IF v_reg.org_number IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.providers WHERE lower(coalesce(org_number, '')) = lower(v_reg.org_number)
  ) THEN
    RAISE EXCEPTION 'ORG_NUMBER_ALREADY_EXISTS' USING errcode = 'P0001';
  END IF;

  -- Guard: a provider can never be a customer of itself. Refuse if a company
  -- (customer) with the same org_number already exists — that identity belongs
  -- to a lunch customer, not a catering provider.
  IF v_reg.org_number IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.companies WHERE lower(coalesce(orgnr, '')) = lower(v_reg.org_number)
  ) THEN
    RAISE EXCEPTION 'ORG_NUMBER_IS_CUSTOMER' USING errcode = 'P0001';
  END IF;

  v_provider_id := gen_random_uuid();

  INSERT INTO public.providers (
    id, name, slug, org_number, contact_email, contact_phone, billing_model, status, created_at, updated_at
  ) VALUES (
    v_provider_id, v_reg.company_name, v_slug, v_reg.org_number, v_reg.contact_email, v_reg.contact_phone,
    'SAAS_FIXED', 'ACTIVE'::public.provider_status, now(), now()
  );

  -- organizations_customer_provider_presence_chk: providers must have NULL legacy_provider_id.
  INSERT INTO public.organizations (id, type, name, slug, org_number, status, legacy_source, legacy_provider_id, created_at, updated_at)
  VALUES (v_provider_id, 'provider', v_reg.company_name, v_slug, v_reg.org_number, 'ACTIVE', 'provider', NULL, now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.provider_settings (
    provider_id, default_currency, default_country_code, timezone, cutoff_time,
    locale, invoice_language, tax_registration, invoice_details,
    operations_email, kitchen_email, delivery_email, created_at, updated_at
  ) VALUES (
    v_provider_id, v_reg.currency, v_reg.country_code,
    coalesce(v_reg.timezone, 'Europe/Oslo'),
    to_char(v_reg.cutoff_local_time, 'HH24:MI'),
    v_reg.operating_language, v_reg.invoice_language, v_reg.tax_registration, v_reg.invoice_details,
    v_reg.order_email, v_reg.kitchen_email, v_reg.delivery_email, now(), now()
  )
  ON CONFLICT (provider_id) DO UPDATE SET
    default_currency = excluded.default_currency,
    default_country_code = excluded.default_country_code,
    timezone = excluded.timezone,
    cutoff_time = excluded.cutoff_time,
    locale = excluded.locale,
    invoice_language = excluded.invoice_language,
    tax_registration = excluded.tax_registration,
    invoice_details = excluded.invoice_details,
    updated_at = now();

  INSERT INTO public.provider_invites (
    provider_id, email, role, token_hash, full_name, registration_id, expires_at, created_by
  ) VALUES (
    v_provider_id, v_reg.contact_email, 'provider_admin'::public.provider_role, p_token_hash,
    v_reg.contact_name, p_registration_id,
    coalesce(p_invite_expires_at, now() + interval '7 days'), p_actor_user_id
  )
  RETURNING id INTO v_invite_id;

  UPDATE public.provider_registrations
  SET status = 'APPROVED',
      provider_id = v_provider_id,
      reviewed_by = p_actor_user_id,
      reviewed_at = now(),
      approval_email_sent_at = now(),
      updated_at = now()
  WHERE id = p_registration_id;

  RETURN jsonb_build_object(
    'ok', true, 'idempotent', false,
    'provider_id', v_provider_id, 'slug', v_slug,
    'invite_id', v_invite_id, 'status', 'APPROVED',
    'contact_email', v_reg.contact_email
  );
END;
$$;

COMMENT ON FUNCTION public.lp_provider_registration_approve(uuid, text, text, timestamptz, uuid) IS
  'Fase 4 superadmin approve: atomic provider + organization + provider_settings + provider_invite bootstrap. Idempotent, fail-closed, no self-customer. service_role only.';

-- ---------------------------------------------------------------------------
-- 7) RPC: first provider_admin invite acceptance — atomic profile + membership.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_provider_admin_invite_accept(
  p_user_id uuid,
  p_token_hash text,
  p_email text,
  p_full_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_invite public.provider_invites%rowtype;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_final_name text;
  v_exists boolean;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'USER_ID_REQUIRED' USING errcode = 'P0001'; END IF;
  IF coalesce(trim(p_token_hash), '') = '' THEN RAISE EXCEPTION 'INVITE_INVALID' USING errcode = 'P0001'; END IF;

  SELECT * INTO v_invite FROM public.provider_invites WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_INVALID' USING errcode = 'P0001'; END IF;
  IF v_invite.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'INVITE_REVOKED' USING errcode = 'P0001'; END IF;
  IF v_email = '' OR lower(trim(coalesce(v_invite.email, ''))) <> v_email THEN
    RAISE EXCEPTION 'INVITE_EMAIL_MISMATCH' USING errcode = 'P0001';
  END IF;

  -- Idempotency: already accepted by this user (membership present).
  IF v_invite.used_at IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.provider_memberships
      WHERE user_id = p_user_id AND provider_id = v_invite.provider_id
    ) INTO v_exists;
    IF v_exists THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true, 'provider_id', v_invite.provider_id, 'email', v_email);
    END IF;
    RAISE EXCEPTION 'INVITE_USED' USING errcode = 'P0001';
  END IF;

  IF v_invite.expires_at <= now() THEN RAISE EXCEPTION 'INVITE_EXPIRED' USING errcode = 'P0001'; END IF;

  -- Bind the profile as provider_admin. Provider scope lives in
  -- provider_memberships (NOT profiles.company_id) — leave company_id NULL.
  UPDATE public.profiles
  SET email = v_email,
      full_name = coalesce(nullif(trim(coalesce(p_full_name, '')), ''), v_invite.full_name, full_name),
      role = 'provider_admin'::public.user_role,
      active = true,
      is_active = true,
      disabled_at = NULL,
      updated_at = now()
  WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING errcode = 'P0001'; END IF;

  INSERT INTO public.provider_memberships (user_id, provider_id, role)
  VALUES (p_user_id, v_invite.provider_id, 'provider_admin'::public.provider_role)
  ON CONFLICT DO NOTHING;

  UPDATE public.provider_invites
  SET used_at = now(), accepted_at = now()
  WHERE id = v_invite.id AND used_at IS NULL;

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'provider_id', v_invite.provider_id, 'email', v_email);
END;
$$;

COMMENT ON FUNCTION public.lp_provider_admin_invite_accept(uuid, text, text, text) IS
  'Fase 4 first provider_admin invite acceptance: atomic profile bind + provider_membership + invite consume. Idempotent, fail-closed. service_role only.';

-- ---------------------------------------------------------------------------
-- 8) Grants (Phase 1 anon lockdown preserved).
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.lp_provider_registration_create(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lp_provider_registration_create(jsonb) TO anon, service_role, postgres;

REVOKE ALL ON FUNCTION public.lp_provider_registration_reject(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lp_provider_registration_reject(uuid, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lp_provider_registration_reject(uuid, text, uuid) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.lp_provider_registration_approve(uuid, text, text, timestamptz, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lp_provider_registration_approve(uuid, text, text, timestamptz, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lp_provider_registration_approve(uuid, text, text, timestamptz, uuid) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.lp_provider_admin_invite_accept(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lp_provider_admin_invite_accept(uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lp_provider_admin_invite_accept(uuid, text, text, text) TO service_role, postgres;

COMMIT;

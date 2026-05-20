-- Patch 13 (Phase E.13) — provider intake: nullable company_id + anon insert guard

ALTER TABLE public.company_registrations
  ALTER COLUMN company_id DROP NOT NULL;

COMMENT ON COLUMN public.company_registrations.company_id IS
  'NULL until provider/superadmin approval (Patch 13 intake). Legacy rows retain company_id.';

DROP POLICY IF EXISTS company_registrations_anon_insert ON public.company_registrations;

CREATE POLICY company_registrations_anon_insert ON public.company_registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'PENDING'
    AND company_id IS NULL
    AND length(btrim(coalesce(company_name, ''))) > 0
    AND length(btrim(coalesce(contact_email, ''))) > 0
    AND requested_postal_code IS NOT NULL
    AND length(regexp_replace(btrim(coalesce(requested_postal_code, '')), '\D', '', 'g')) = 4
  );

GRANT INSERT ON public.company_registrations TO anon;
GRANT INSERT ON public.company_registrations TO authenticated;

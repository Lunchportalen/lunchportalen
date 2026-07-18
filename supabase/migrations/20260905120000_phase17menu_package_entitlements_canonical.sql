-- PHASE 17MENU — Canonical package entitlement keys (dual-read safe)
-- Staging-first; does not activate non-NO countries or change MVA/Stripe.
-- Protected Golden Path Impact: Melhus entitlements remain readable via legacy keys
-- until dual-read cutover completes; adds enterprise_upgrade for ENTERPRISE.

BEGIN;

-- Dual-write canonical menu_category:* rows for Melhus (and any provider with legacy rows).
INSERT INTO public.provider_package_entitlements (
  provider_id, package_key, entitlement_key, is_enabled, default_value
)
SELECT
  e.provider_id,
  e.package_key,
  CASE e.entitlement_key
    WHEN 'menu_category:paasmurt' THEN 'menu_category:sandwich'
    WHEN 'menu_category:salat' THEN 'menu_category:salad_box'
    WHEN 'menu_category:varmrett' THEN 'menu_category:warm_meal'
    WHEN 'menu_category:pokebowl' THEN 'menu_category:poke_bowl'
    WHEN 'menu_category:thai' THEN 'menu_category:thai'
    WHEN 'menu_category:sushi' THEN 'menu_category:sushi'
    ELSE NULL
  END AS entitlement_key,
  e.is_enabled,
  e.default_value
FROM public.provider_package_entitlements e
WHERE e.entitlement_key IN (
  'menu_category:paasmurt',
  'menu_category:salat',
  'menu_category:varmrett',
  'menu_category:pokebowl',
  'menu_category:thai',
  'menu_category:sushi'
)
ON CONFLICT (provider_id, package_key, entitlement_key) DO UPDATE
SET is_enabled = EXCLUDED.is_enabled,
    updated_at = now();

-- Enterprise upgrade entitlement (metadata; not an orderable category).
INSERT INTO public.provider_package_entitlements (
  provider_id, package_key, entitlement_key, is_enabled, default_value
)
SELECT DISTINCT
  e.provider_id,
  'ENTERPRISE',
  'enterprise_upgrade',
  true,
  jsonb_build_object(
    'kind', 'upgrade_on_shared_warm_dish',
    'can_order', false,
    'source', 'phase17menu'
  )
FROM public.provider_package_entitlements e
WHERE e.package_key = 'ENTERPRISE'
ON CONFLICT (provider_id, package_key, entitlement_key) DO UPDATE
SET is_enabled = true,
    default_value = EXCLUDED.default_value,
    updated_at = now();

COMMENT ON TABLE public.provider_package_entitlements IS
  'PHASE 17MENU: runtime-read via lib/providers/resolvePackageEntitlements.ts. Dual-read legacy menu_category:paasmurt|salat|… and canonical sandwich|salad_box|….';

COMMIT;

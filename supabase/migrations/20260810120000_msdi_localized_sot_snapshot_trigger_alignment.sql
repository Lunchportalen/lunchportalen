-- F4b: MSDI localized SOT snapshot trigger alignment (source/migration only).
-- READ: docs/evidence/danish-sot-cutover-f4-evidence.md
-- Scope: tg_menu_service_day_item_snapshot preserves explicit localized_generated_content rows.
-- Legacy tier-product snapshot behavior unchanged when snapshot_mode IS NULL or incomplete.
-- Does NOT apply to production in this PR. Does NOT wire SOT runtime, order write-path, billing, or orders.

BEGIN;

-- Canonical mode token — must match LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE
-- in lib/menu-generator/sotMsdiItemMapping.ts
ALTER TABLE public.menu_service_day_items
  ADD COLUMN IF NOT EXISTS snapshot_mode text NULL;

ALTER TABLE public.menu_service_day_items
  DROP CONSTRAINT IF EXISTS menu_service_day_items_snapshot_mode_check;

ALTER TABLE public.menu_service_day_items
  ADD CONSTRAINT menu_service_day_items_snapshot_mode_check
  CHECK (
    snapshot_mode IS NULL
    OR snapshot_mode = 'localized_generated_content'
  );

CREATE OR REPLACE FUNCTION public.tg_menu_service_day_item_snapshot() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_company_id uuid;
  v_service_date date;
  v_name text;
  v_unit text;
  v_vat numeric(5,2);
  v_price integer;
  v_localized_mode constant text := 'localized_generated_content';
begin
  perform public.assert_menu_day_mutable(new.menu_service_day_id);

  select msd.company_id, msd.service_date
  into v_company_id, v_service_date
  from public.menu_service_days msd
  where msd.id = new.menu_service_day_id;

  if v_company_id is null then
    raise exception 'Unknown menu day: %', new.menu_service_day_id;
  end if;

  select
    p.name,
    p.unit_name,
    p.vat_rate,
    public.get_effective_product_price_ex_vat(v_company_id, p.id, v_service_date)
  into v_name, v_unit, v_vat, v_price
  from public.products p
  where p.id = new.product_id
    and p.is_active = true
    and p.is_visible = true
    and (p.company_id is null or p.company_id = v_company_id);

  if v_name is null then
    raise exception 'Unknown or inactive product: %', new.product_id;
  end if;

  -- Localized SOT snapshot: preserve application-supplied commercial fields when explicitly marked.
  -- Fail-closed: missing/ambiguous localized payload falls back to legacy tier-product resolution.
  if new.snapshot_mode = v_localized_mode
     and nullif(btrim(new.product_name_snapshot), '') is not null
     and nullif(btrim(new.unit_name_snapshot), '') is not null
     and new.vat_rate_snapshot is not null
     and new.offered_price_cents_ex_vat is not null
     and new.offered_price_cents_ex_vat >= 0
  then
    return new;
  end if;

  -- Legacy: tier-product snapshot from global products catalog (unchanged semantics).
  new.snapshot_mode := null;
  new.product_name_snapshot := v_name;
  new.unit_name_snapshot := v_unit;
  new.vat_rate_snapshot := v_vat;
  new.offered_price_cents_ex_vat := coalesce(new.offered_price_cents_ex_vat, v_price);

  return new;
end;
$$;

COMMENT ON COLUMN public.menu_service_day_items.snapshot_mode IS
  'NULL = legacy tier-product snapshot. localized_generated_content = preserve app-supplied MSDI snapshots (SOT localized mapping).';

-- RLS: intentionally unchanged.
-- Rollback: DROP COLUMN snapshot_mode; restore prior tg_menu_service_day_item_snapshot from baseline.

COMMIT;

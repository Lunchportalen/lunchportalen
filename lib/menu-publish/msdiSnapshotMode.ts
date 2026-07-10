/**
 * MSDI snapshot_mode column contract — menu-publish + Supabase F4b migration.
 * Must stay aligned with tg_menu_service_day_item_snapshot and sotMsdiItemMapping.
 */

import {
  LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE,
  type MsdiLocalizedItemMappingSuccess,
} from "@/lib/menu-generator/sotMsdiItemMapping";

export { LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE };

export type MsdiSnapshotMode = typeof LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE;

export function resolveMsdiSnapshotModeForLocalizedSync(active: boolean): MsdiSnapshotMode | null {
  return active ? LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE : null;
}

export function isCompleteLocalizedSotMsdiSnapshotRow(input: {
  snapshotMode: string | null | undefined;
  productNameSnapshot: string;
  unitNameSnapshot: string;
  offeredPriceCentsExVat: number;
  vatRateSnapshot: number;
}): boolean {
  if (input.snapshotMode !== LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE) return false;
  if (!String(input.productNameSnapshot ?? "").trim()) return false;
  if (!String(input.unitNameSnapshot ?? "").trim()) return false;
  if (!Number.isFinite(input.offeredPriceCentsExVat) || input.offeredPriceCentsExVat < 0) return false;
  if (!Number.isFinite(input.vatRateSnapshot)) return false;
  return true;
}

export function buildLocalizedSotMsdiUpsertFields(
  localized: MsdiLocalizedItemMappingSuccess,
  unitNameSnapshot = "porsjon",
): {
  snapshot_mode: MsdiSnapshotMode;
  product_name_snapshot: string;
  unit_name_snapshot: string;
  offered_price_cents_ex_vat: number;
  vat_rate_snapshot: number;
} {
  return {
    snapshot_mode: LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE,
    product_name_snapshot: localized.productNameSnapshot,
    unit_name_snapshot: unitNameSnapshot,
    offered_price_cents_ex_vat: localized.offeredPriceCentsExVat,
    vat_rate_snapshot: localized.vatRateSnapshot,
  };
}

import { describe, expect, it } from "vitest";

import { LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE } from "@/lib/menu-generator/sotMsdiItemMapping";
import {
  buildLocalizedSotMsdiUpsertFields,
  isCompleteLocalizedSotMsdiSnapshotRow,
  resolveMsdiSnapshotModeForLocalizedSync,
} from "@/lib/menu-publish/msdiSnapshotMode";

describe("msdiSnapshotMode", () => {
  it("resolveMsdiSnapshotModeForLocalizedSync is null when inactive", () => {
    expect(resolveMsdiSnapshotModeForLocalizedSync(false)).toBeNull();
  });

  it("resolveMsdiSnapshotModeForLocalizedSync returns canonical token when active", () => {
    expect(resolveMsdiSnapshotModeForLocalizedSync(true)).toBe(LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE);
  });

  it("isCompleteLocalizedSotMsdiSnapshotRow requires canonical mode and complete payload", () => {
    expect(
      isCompleteLocalizedSotMsdiSnapshotRow({
        snapshotMode: LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE,
        productNameSnapshot: "Kylling i karry",
        unitNameSnapshot: "porsjon",
        offeredPriceCentsExVat: 10500,
        vatRateSnapshot: 0.25,
      }),
    ).toBe(true);

    expect(
      isCompleteLocalizedSotMsdiSnapshotRow({
        snapshotMode: null,
        productNameSnapshot: "Kylling i karry",
        unitNameSnapshot: "porsjon",
        offeredPriceCentsExVat: 10500,
        vatRateSnapshot: 0.25,
      }),
    ).toBe(false);
  });

  it("buildLocalizedSotMsdiUpsertFields maps DKK localized snapshot without NOK defaults", () => {
    const fields = buildLocalizedSotMsdiUpsertFields({
      ok: true,
      productNameSnapshot: "Kylling i karry",
      offeredPriceCentsExVat: 10500,
      vatRateSnapshot: 0.25,
      currency: "DKK",
      snapshotMode: LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE,
    });

    expect(fields.snapshot_mode).toBe(LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE);
    expect(fields.product_name_snapshot).toBe("Kylling i karry");
    expect(fields.offered_price_cents_ex_vat).toBe(10500);
    expect(fields.vat_rate_snapshot).toBe(0.25);
    expect(fields.offered_price_cents_ex_vat).not.toBe(9000);
  });
});

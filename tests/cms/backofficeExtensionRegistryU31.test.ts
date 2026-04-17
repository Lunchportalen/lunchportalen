import { describe, expect, it } from "vitest";

import {
  BACKOFFICE_SETTINGS_BASE_PATH,
  BACKOFFICE_TOPBAR_MODULE_OVERFLOW,
  getBackofficeExtensionById,
} from "@/lib/cms/backofficeExtensionRegistry";

describe("backofficeExtensionRegistry (U31)", () => {
  it("settings entry is managementPlane and uses canonical base path", () => {
    const s = getBackofficeExtensionById("nav.settings");
    expect(s?.href).toBe(BACKOFFICE_SETTINGS_BASE_PATH);
    expect(s?.managementPlane).toBe(true);
  });

  it("exports overflow limit for TopBar module row", () => {
    expect(BACKOFFICE_TOPBAR_MODULE_OVERFLOW).toBeGreaterThanOrEqual(2);
    expect(BACKOFFICE_TOPBAR_MODULE_OVERFLOW).toBeLessThanOrEqual(12);
  });
});

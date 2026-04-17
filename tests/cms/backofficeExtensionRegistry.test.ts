import { describe, expect, it } from "vitest";

import {
  BACKOFFICE_NAV_GROUP_LABEL,
  BACKOFFICE_NAV_GROUP_ORDER,
  BACKOFFICE_SETTINGS_WORKSPACE_VIEWS,
  BACKOFFICE_SETTINGS_BASE_PATH,
  findBackofficeExtensionForPathname,
  getBackofficeNavItemsForTopBar,
} from "@/lib/cms/backofficeExtensionRegistry";

describe("backofficeExtensionRegistry (U31 section model)", () => {
  it("includes settings as its own section in group order", () => {
    expect(BACKOFFICE_NAV_GROUP_ORDER).toContain("settings");
    expect(BACKOFFICE_NAV_GROUP_ORDER.indexOf("settings")).toBeLessThan(
      BACKOFFICE_NAV_GROUP_ORDER.indexOf("system")
    );
    expect(BACKOFFICE_NAV_GROUP_LABEL.settings).toContain("innstillinger");
  });

  it("maps settings routes to nav.settings with settings sectionId", () => {
    const extHub = findBackofficeExtensionForPathname(`${BACKOFFICE_SETTINGS_BASE_PATH}`);
    const extDt = findBackofficeExtensionForPathname(`${BACKOFFICE_SETTINGS_BASE_PATH}/document-types/foo`);
    expect(extHub?.id).toBe("nav.settings");
    expect(extHub?.sectionId).toBe("settings");
    expect(extDt?.id).toBe("nav.settings");
    expect(extDt?.sectionId).toBe("settings");
  });

  it("exposes settings in top bar items", () => {
    const items = getBackofficeNavItemsForTopBar();
    const settings = items.find((i) => i.href === BACKOFFICE_SETTINGS_BASE_PATH);
    expect(settings?.groupId).toBe("settings");
  });

  it("keeps settings workspace tabs aligned with management routes", () => {
    const ids = BACKOFFICE_SETTINGS_WORKSPACE_VIEWS.map((item) => item.id);
    expect(ids).toContain("schema");
    expect(ids).toContain("management-read");
    expect(ids).toContain("ai-governance");
    expect(ids).toContain("system");
  });
});

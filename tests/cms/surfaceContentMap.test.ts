import { describe, expect, it } from "vitest";

import { getSurfaceStringFromSettingsData } from "@/lib/cms/surfaceStringResolve";
import {
  resolveSurfaceBinding,
  resolveSurfaceBindingWithDefault,
} from "@/lib/cms/surfaceContentMap";

describe("surfaceContentMap", () => {
  it("matches longest prefix for backoffice", () => {
    const b = resolveSurfaceBinding("/backoffice/content/abc");
    expect(b?.surface).toBe("ai_overview");
    expect(b?.nodeId).toBe("backoffice:root");
  });

  it("matches ai overview subpath over backoffice root", () => {
    const b = resolveSurfaceBinding("/backoffice/ai/overview");
    expect(b?.nodeId).toBe("backoffice:ai:overview");
  });

  it("defaults unknown marketing path to public_home", () => {
    const b = resolveSurfaceBindingWithDefault("/hva-er-lunsjordning");
    expect(b.surface).toBe("public_home");
  });

  it("root path resolves to public_home rule", () => {
    const b = resolveSurfaceBinding("/");
    expect(b?.surface).toBe("public_home");
  });
});

describe("cmsContent.getFromSettingsData", () => {
  it("returns fallback when bucket missing", () => {
    expect(getSurfaceStringFromSettingsData({}, "kitchen_view", "empty", "fallback")).toBe("fallback");
  });

  it("reads nested surfaceCopy", () => {
    const data = { surfaceCopy: { kitchen_view: { empty: "  Tomt  " } } };
    expect(getSurfaceStringFromSettingsData(data as Record<string, unknown>, "kitchen_view", "empty", "x")).toBe("Tomt");
  });
});

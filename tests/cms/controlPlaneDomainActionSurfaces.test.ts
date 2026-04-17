import { describe, expect, it } from "vitest";

import {
  CONTROL_PLANE_DOMAIN_ACTION_SURFACES,
  getDomainActionSurfaceById,
} from "@/lib/cms/controlPlaneDomainActionSurfaces";

describe("controlPlaneDomainActionSurfaces", () => {
  it("har forventede kjerne-id-er", () => {
    const ids = new Set(CONTROL_PLANE_DOMAIN_ACTION_SURFACES.map((s) => s.id));
    expect(ids.has("week_menu")).toBe(true);
    expect(ids.has("agreement_runtime")).toBe(true);
    expect(ids.has("superadmin_tower")).toBe(true);
  });

  it("getDomainActionSurfaceById finner agreement_runtime", () => {
    const s = getDomainActionSurfaceById("agreement_runtime");
    expect(s?.cmsSurfaceHref).toBe("/backoffice/agreement-runtime");
  });

  it("week_menu har CP5 actionRouting med publishControl", () => {
    const s = getDomainActionSurfaceById("week_menu");
    expect(s?.actionRouting?.publishControl).toBeTruthy();
    expect(s?.actionRouting?.reads?.length).toBeGreaterThan(0);
  });

  it("CP6 whyMatters finnes på firma og uke", () => {
    expect(getDomainActionSurfaceById("companies_customers")?.actionRouting?.whyMatters).toBeTruthy();
    expect(getDomainActionSurfaceById("week_menu")?.actionRouting?.whyMatters).toBeTruthy();
  });
});

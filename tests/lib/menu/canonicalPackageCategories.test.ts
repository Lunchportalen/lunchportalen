import { describe, expect, it } from "vitest";

import {
  PACKAGE_CANONICAL_CATEGORIES,
  PACKAGE_ORDERABLE_CATEGORIES,
  canonicalFromEntitlementKey,
  canonicalFromNorwayCmsCategory,
  canonicalFromNorwayOrderChoice,
  entitlementKeyForCanonical,
  norwayCmsCategoryForCanonical,
  norwayOrderChoiceForCanonical,
  packageAllowsOrderable,
} from "@/lib/menu/canonicalPackageCategories";

describe("canonicalPackageCategories", () => {
  it("defines global package contracts", () => {
    expect(PACKAGE_ORDERABLE_CATEGORIES.BASIS).toEqual(["sandwich", "salad_box", "warm_meal"]);
    expect(PACKAGE_ORDERABLE_CATEGORIES.LUXUS).toContain("sushi");
    expect(PACKAGE_ORDERABLE_CATEGORIES.LUXUS).toContain("poke_bowl");
    expect(PACKAGE_ORDERABLE_CATEGORIES.LUXUS).toContain("thai");
    expect(PACKAGE_CANONICAL_CATEGORIES.ENTERPRISE).toContain("enterprise_upgrade");
    expect(PACKAGE_ORDERABLE_CATEGORIES.ENTERPRISE).not.toContain("enterprise_upgrade");
  });

  it("maps Norway runtime keys bidirectionally", () => {
    expect(norwayOrderChoiceForCanonical("sandwich")).toBe("paasmurt");
    expect(norwayOrderChoiceForCanonical("salad_box")).toBe("salatboks");
    expect(norwayOrderChoiceForCanonical("warm_meal")).toBe("varmmat");
    expect(norwayOrderChoiceForCanonical("poke_bowl")).toBe("pokebowl");
    expect(norwayOrderChoiceForCanonical("thai")).toBe("thaimat");
    expect(norwayCmsCategoryForCanonical("salad_box")).toBe("salat");
    expect(canonicalFromNorwayOrderChoice("paasmurt")).toBe("sandwich");
    expect(canonicalFromNorwayOrderChoice("salatboks")).toBe("salad_box");
    expect(canonicalFromNorwayCmsCategory("salat")).toBe("salad_box");
    expect(canonicalFromNorwayCmsCategory("varmrett")).toBe("warm_meal");
  });

  it("dual-reads legacy and canonical entitlement keys", () => {
    expect(canonicalFromEntitlementKey("menu_category:paasmurt")).toBe("sandwich");
    expect(canonicalFromEntitlementKey("menu_category:sandwich")).toBe("sandwich");
    expect(canonicalFromEntitlementKey("menu_category:pokebowl")).toBe("poke_bowl");
    expect(canonicalFromEntitlementKey("menu_category:poke_bowl")).toBe("poke_bowl");
    expect(canonicalFromEntitlementKey("auto_warm_meal")).toBe("warm_meal");
    expect(canonicalFromEntitlementKey("enterprise_upgrade")).toBe("enterprise_upgrade");
    expect(entitlementKeyForCanonical("sandwich")).toBe("menu_category:sandwich");
    expect(entitlementKeyForCanonical("enterprise_upgrade")).toBe("enterprise_upgrade");
  });

  it("blocks Luxus categories on Basis", () => {
    expect(packageAllowsOrderable("BASIS", "sushi")).toBe(false);
    expect(packageAllowsOrderable("BASIS", "poke_bowl")).toBe(false);
    expect(packageAllowsOrderable("BASIS", "thai")).toBe(false);
    expect(packageAllowsOrderable("LUXUS", "sushi")).toBe(true);
    expect(packageAllowsOrderable("ENTERPRISE", "warm_meal")).toBe(true);
  });
});

/**
 * G5d.0 — Menu profile runtime cutover contract tests (tests only).
 * Locks current save/catalog/publish/order/week contracts before G5d implementation.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, test } from "vitest";

import {
  CATEGORIES,
  ORDER_CHOICE_KEY_BY_CATEGORY,
  PLAN_ORDER_CHOICE_KEYS,
  PLAN_TIERS,
} from "@/lib/cms/menuDayContract";
import { categoryFromLunchCategoryKey, EDITABLE_LUNCH_CATEGORY_KEYS } from "@/lib/provider-menu/lunchCategoryCatalog";
import { canonicalMenuCategory } from "@/lib/provider-menu/menuCategoryCanonical";
import { buildMenuDayPayload } from "@/lib/provider-menu/menuDayPayload";
import {
  validateMenuCatalogWriteInput,
} from "@/lib/provider-menu/menuCatalogWrite";
import { resolveNoCategoryRuntimeMapping } from "@/lib/menu-profile/noCategoryRuntimeMap";
import {
  buildProviderMenuWarmDishPreviewPresentation,
  buildMenuProfileWarmDishPreview,
} from "@/lib/provider-menu/providerMenuProfileWarmDishPreview";
import { resolveMenuProfileForProvider } from "@/lib/menu-profile/resolver";
import {
  LP_MENU_PROFILE_RESOLVER_ENV,
  LP_MENU_PROFILE_WARM_DISH_PREVIEW_ENV,
} from "@/lib/menu-profile/featureFlag";
import { getWarmDishBankSeedsForProfile } from "@/lib/menu-profile/warmDishBankSeeds";
import { assertEmployeeOrderBodyHasNoPricingOverrides } from "@/lib/orders/orderWriteGuard";
import {
  choiceKeyToMsdiCategorySlug,
  msdiSlugResolvesInCatalog,
} from "@/lib/orders/msdiChoiceSlug";
import { LUNCH_CATEGORY_KEY_TO_DB_NAME } from "@/lib/menu-publish/syncMenuServiceDayItems";
import { formatProviderOrderItemLine } from "@/lib/providers/kitchenOrderDisplay";
import {
  CANONICAL_CATEGORIES,
  CANONICAL_LUNCH_CATEGORY_KEYS,
  CANONICAL_ORDER_CHOICE_KEYS,
  EDITABLE_CATALOG_KEYS,
  EMPLOYEE_COMMERCIAL_FIELD_NAMES,
  PROFILE_KEYS_MUST_NOT_LEAK,
  PROVIDER_OWNED_TITLE_SAMPLE,
  WARM_DISH_PREVIEW_ID_SAMPLES,
} from "../fixtures/g5d0-runtime-contract.constants";

const ROOT = process.cwd();
const PROVIDER_B = "22222222-2222-2222-2222-222222222222";

const MENU_DAY_VALID = {
  date: "2026-06-16",
  tier: "BASIS",
  category: "varmrett",
  mealTitle: "Kyllinggryte",
  description: "Med rotgrønnsaker.",
  status: "draft" as const,
};

const BOTH_G5_FLAGS = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_WARM_DISH_PREVIEW_ENV]: "true",
};

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function rel(absPath: string): string {
  return path.normalize(path.relative(ROOT, absPath));
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walkFiles(p, out);
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

function filesUnderPrefixes(prefixes: string[]): string[] {
  const out: string[] = [];
  for (const prefix of prefixes) {
    walkFiles(path.join(ROOT, prefix), out);
  }
  return out;
}

function assertNoForbiddenImports(
  filePaths: string[],
  forbidden: RegExp[],
  allowlist: Set<string> = new Set(),
): void {
  const offenders: string[] = [];
  for (const filePath of filePaths) {
    const r = rel(filePath);
    if (allowlist.has(r)) continue;
    if (r.includes(`${path.sep}tests${path.sep}`)) continue;
    const src = fs.readFileSync(filePath, "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(src)) {
        offenders.push(`${r} → ${pattern}`);
        break;
      }
    }
  }
  expect(offenders, `forbidden imports:\n${offenders.join("\n")}`).toEqual([]);
}

describe("G5d.0 — NO runtime key contracts (locked)", () => {
  test("Category union matches canonical six keys", () => {
    expect([...CATEGORIES]).toEqual([...CANONICAL_CATEGORIES]);
  });

  test("salatboks → salat lunchCategory mapping", () => {
    expect(categoryFromLunchCategoryKey("salatboks")).toBe("salat");
    expect(canonicalMenuCategory("salatboks")).toBe("salat");
  });

  test("thaimat → thai lunchCategory mapping", () => {
    expect(categoryFromLunchCategoryKey("thaimat")).toBe("thai");
    expect(canonicalMenuCategory("thaimat")).toBe("thai");
  });

  test("varmrett → varmmat order choice mapping (NO Golden Path)", () => {
    expect(ORDER_CHOICE_KEY_BY_CATEGORY.varmrett).toBe("varmmat");
    expect(resolveNoCategoryRuntimeMapping("varmrett")?.runtimeOrderChoiceKey).toBe("varmmat");
    expect(choiceKeyToMsdiCategorySlug("varmmat")).toBe("varmrett");
  });

  test("PLAN_ORDER_CHOICE_KEYS use only canonical order choice keys", () => {
    const all = PLAN_TIERS.flatMap((tier) => PLAN_ORDER_CHOICE_KEYS[tier]);
    expect(new Set(all)).toEqual(new Set(CANONICAL_ORDER_CHOICE_KEYS));
    for (const key of all) {
      expect(msdiSlugResolvesInCatalog(choiceKeyToMsdiCategorySlug(key))).toBe(true);
    }
  });

  test("publish MSDI lunch keys match canonical catalog keys", () => {
    expect(Object.keys(LUNCH_CATEGORY_KEY_TO_DB_NAME).sort()).toEqual(
      [...CANONICAL_LUNCH_CATEGORY_KEYS].sort(),
    );
  });

  test("editable catalog keys exclude varmrett", () => {
    expect([...EDITABLE_LUNCH_CATEGORY_KEYS]).toEqual([...EDITABLE_CATALOG_KEYS]);
    expect(EDITABLE_LUNCH_CATEGORY_KEYS).not.toContain("varmrett");
  });
});

describe("G5d.0 — profile keys must not leak to save/menuDayPayload", () => {
  for (const profileKey of PROFILE_KEYS_MUST_NOT_LEAK) {
    test(`buildMenuDayPayload rejects profile key: ${profileKey}`, () => {
      const res = buildMenuDayPayload(PROVIDER_B, {
        ...MENU_DAY_VALID,
        category: profileKey,
      });
      expect(res.ok).toBe(false);
    });
  }

  for (const previewId of WARM_DISH_PREVIEW_ID_SAMPLES) {
    test(`buildMenuDayPayload rejects warm dish preview id: ${previewId}`, () => {
      const res = buildMenuDayPayload(PROVIDER_B, {
        ...MENU_DAY_VALID,
        category: previewId,
      });
      expect(res.ok).toBe(false);
    });
  }

  test("successful menuDay payload uses canonical Category only", () => {
    const res = buildMenuDayPayload(PROVIDER_B, MENU_DAY_VALID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(CANONICAL_CATEGORIES).toContain(res.payload.category);
    const serialized = JSON.stringify(res.payload);
    for (const key of PROFILE_KEYS_MUST_NOT_LEAK) {
      expect(serialized).not.toContain(key);
    }
    for (const id of WARM_DISH_PREVIEW_ID_SAMPLES) {
      expect(serialized).not.toContain(id);
    }
    expect(serialized).not.toContain("profileCategoryKey");
    expect(serialized).not.toContain("menuProfileId");
  });

  test("ProviderMenuBuilder save payload shape excludes G5 presentation fields", () => {
    const src = readSource("components/providers/ProviderMenuBuilder.tsx");
    const saveBlock = src.slice(src.indexOf("async function save"), src.indexOf("async function save") + 2500);
    expect(saveBlock).toContain("JSON.stringify(payload)");
    expect(saveBlock).not.toContain("profileCategoryKey");
    expect(saveBlock).not.toContain("warmDishPreview");
    expect(saveBlock).not.toContain("runtimeMappingProposal");
    expect(saveBlock).not.toContain("menuProfile");
    expect(saveBlock).not.toContain("fixedCategories");
  });
});

describe("G5d.0 — catalog save payload contracts", () => {
  for (const profileKey of ["panini", "insalata", "belegte_broetchen"]) {
    test(`validateMenuCatalogWriteInput rejects profile category: ${profileKey}`, () => {
      const err = validateMenuCatalogWriteInput({
        categoryKey: profileKey,
        items: [{ title: "Test" }],
      });
      expect(err).toBeTruthy();
    });
  }

  test("provider-owned title passes through catalog validation unchanged (no locale transform)", () => {
    const title = PROVIDER_OWNED_TITLE_SAMPLE;
    const err = validateMenuCatalogWriteInput({
      categoryKey: "paasmurt",
      items: [{ title, allergens: [] }],
    });
    expect(err).toBeNull();
  });

  test("menuCatalogWrite does not auto-translate provider-owned titles via i18n", () => {
    const src = readSource("lib/provider-menu/menuCatalogWrite.ts");
    expect(src).not.toMatch(/useTranslations|loadMessagesForLocale|next-intl/);
    expect(src).toContain("title");
  });

  test("warm dish preview suggestions are not catalog write input", () => {
    const resolver = resolveMenuProfileForProvider({
      menuProfileId: "norwegian_company_lunch",
      env: BOTH_G5_FLAGS,
    });
    const preview = buildProviderMenuWarmDishPreviewPresentation(resolver, "NOK", BOTH_G5_FLAGS);
    expect(preview.active).toBe(true);
    if (!preview.active) return;
    for (const item of preview.items) {
      expect(item.id.startsWith("warm-dish-preview:")).toBe(true);
      const err = validateMenuCatalogWriteInput({
        categoryKey: item.id,
        items: [{ title: item.title }],
      });
      expect(err).toBeTruthy();
    }
  });
});

describe("G5d.0 — publish / menuDayPayload static separation", () => {
  const FORBIDDEN_MENU_PROFILE_IMPORTS = [
    /warmDishBankSeeds/,
    /providerMenuProfileWarmDishPreview/,
    /providerMenuProfileFixedCategories/,
    /noCategoryRuntimeMap/,
    /providerMenuProfilePresentation/,
    /runtimeMapping/,
  ];

  test("lib/menu-publish must not import menu profile presentation/runtime bridge", () => {
    const publishFiles = walkFiles(path.join(ROOT, "lib", "menu-publish"));
    assertNoForbiddenImports(publishFiles, FORBIDDEN_MENU_PROFILE_IMPORTS);
  });

  test("runMenuWeekRolloutCore writes varmrett category only", () => {
    const src = readSource("lib/menu-publish/runMenuWeekRolloutCore.ts");
    expect(src).toContain('MENU_DAY_CATEGORY = "varmrett"');
    expect(src).not.toContain("warm-dish-preview:");
    expect(src).not.toMatch(/from ["']@\/lib\/menu-profile/);
  });

  test("warm dish preview IDs never appear in menuDayPayload source", () => {
    const src = readSource("lib/provider-menu/menuDayPayload.ts");
    expect(src).not.toContain("warm-dish-preview:");
    expect(src).not.toMatch(/from ["']@\/lib\/menu-profile/);
  });
});

describe("G5d.0 — order write-path contracts", () => {
  test("profile keys are not valid order choice keys", () => {
    const allChoices = new Set(PLAN_TIERS.flatMap((t) => PLAN_ORDER_CHOICE_KEYS[t]));
    for (const profileKey of PROFILE_KEYS_MUST_NOT_LEAK) {
      expect(allChoices.has(profileKey)).toBe(false);
    }
    for (const previewId of WARM_DISH_PREVIEW_ID_SAMPLES) {
      expect(allChoices.has(previewId)).toBe(false);
    }
  });

  test("kitchen display uses snapshot title, not live profile label", () => {
    const line = formatProviderOrderItemLine({
      choiceLabel: "Påsmurt",
      variantTitle: "Laks & Eggerøre",
      productNameSnapshot: "Laks & Eggerøre",
    });
    expect(line).toBe("Påsmurt · Laks & Eggerøre");
    expect(line).not.toContain("panini");
  });

  test("order write paths must not import warm dish preview / profile presentation", () => {
    const orderFiles = filesUnderPrefixes(["app/api/orders", "lib/orders"]);
    assertNoForbiddenImports(orderFiles, [
      /providerMenuProfileWarmDishPreview/,
      /warmDishBankSeeds/,
      /providerMenuProfileFixedCategories/,
      /runtimeMapping/,
    ]);
  });
});

describe("G5d.0 — employee /week price-free contracts", () => {
  test("assertEmployeeOrderBodyHasNoPricingOverrides blocks commercial fields", () => {
    for (const field of ["price", "unit_price", "currency", "tier", "plan"]) {
      const res = assertEmployeeOrderBodyHasNoPricingOverrides({ [field]: 100 }, "employee");
      expect(res.ok).toBe(false);
    }
    expect(assertEmployeeOrderBodyHasNoPricingOverrides({ choice_key: "paasmurt" }, "employee").ok).toBe(
      true,
    );
  });

  test("order/window route types exclude commercial pricing fields", () => {
    const src = readSource("app/api/order/window/route.ts");
    const typeBlock = src.slice(src.indexOf("type DayCategoryItem"), src.indexOf("type AgreementStatusOut"));
    for (const field of EMPLOYEE_COMMERCIAL_FIELD_NAMES) {
      expect(typeBlock, `DayCategory* must not expose ${field}`).not.toMatch(
        new RegExp(`\\b${field}\\b\\s*:`),
      );
    }
    expect(src).not.toContain("warm-dish-preview:");
    expect(src).not.toContain("ProviderMenuProfileWarmDishPreviewPanel");
  });

  test("/week employee surfaces must not import provider profile preview or price preview", () => {
    const weekFiles = filesUnderPrefixes([
      "app/(app)/week",
      "app/api/order/window",
      "app/api/week",
      "lib/week",
    ]);
    assertNoForbiddenImports(weekFiles, [
      /ProviderMenuProfileWarmDishPreviewPanel/,
      /ProviderMenuProfileFixedCategoriesPanel/,
      /ProviderMenuProfilePresentationBanner/,
      /providerMenuProfileWarmDishPreview/,
      /providerMenuPricePreview/,
      /provider_price_rules/,
      /tripletexEngine/,
      /runtimeMapping/,
    ]);
  });
});

describe("G5d.0 — warm dish preview isolation from runtime", () => {
  test("preview items carry warm-dish-preview id prefix and canPublish=false", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "norwegian_company_lunch",
      env: BOTH_G5_FLAGS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.enabled) return;

    const seeds = getWarmDishBankSeedsForProfile(result.profile.id);
    const preview = buildMenuProfileWarmDishPreview({
      profile: result.profile,
      warmDishBankSeeds: seeds,
      locale: "nb-NO",
      market: "NO",
      currency: "NOK",
    });
    expect(preview.items.length).toBeGreaterThan(0);
    for (const item of preview.items) {
      expect(item.id.startsWith("warm-dish-preview:")).toBe(true);
      expect(item.canPublish).toBe(false);
      expect(item.canApplyToMenu).toBe(false);
      expect(item.isPreviewOnly).toBe(true);
    }
  });
});

describe("G5d.0 — billing / Tripletex not in scope", () => {
  test("this contract suite does not import billing or Tripletex runtime", () => {
    const src = readSource("tests/governance/g5d0-menu-profile-runtime-contracts.test.ts");
    const importLines = src
      .split(/\r?\n/)
      .filter((line) => /^\s*import\s/.test(line))
      .join("\n");
    expect(importLines).not.toMatch(/from ["']@\/lib\/integrations\/tripletex/);
    expect(importLines).not.toMatch(/from ["']@\/lib\/billing/);
  });

  test("menu-profile module does not import billing/Tripletex", () => {
    const menuProfileDir = path.join(ROOT, "lib", "menu-profile");
    const files = walkFiles(menuProfileDir);
    assertNoForbiddenImports(files, [/tripletex/i, /provider_price_rules/, /invoiceEngine/]);
  });
});

describe("G5d.0 — static import guards (protected separation)", () => {
  const MENU_PROFILE_PRESENTATION_IMPORTS = [
    /warmDishBankSeeds/,
    /providerMenuProfileWarmDishPreview/,
    /providerMenuProfileFixedCategories/,
  ];

  test("Sanity write paths must not import warm dish bank / preview models", () => {
    const sanityWriteFiles = [
      path.join(ROOT, "lib/provider-menu/menuDayPayload.ts"),
      path.join(ROOT, "lib/provider-menu/menuCatalogWrite.ts"),
      path.join(ROOT, "lib/provider-menu/varmrettSharedWrite.ts"),
      path.join(ROOT, "app/api/provider/menu-catalog/route.ts"),
      path.join(ROOT, "app/api/provider/menu-days/route.ts"),
    ].filter((p) => fs.existsSync(p));
    assertNoForbiddenImports(sanityWriteFiles, MENU_PROFILE_PRESENTATION_IMPORTS);
  });

  test("G5a/G5b/G5c presentation modules must not import order write-path or menuDayPayload", () => {
    const presentationFiles = [
      "lib/provider-menu/providerMenuProfilePresentation.ts",
      "lib/provider-menu/providerMenuProfileFixedCategories.ts",
      "lib/provider-menu/providerMenuProfileWarmDishPreview.ts",
      "components/providers/ProviderMenuProfilePresentationBanner.tsx",
      "components/providers/ProviderMenuProfileFixedCategoriesPanel.tsx",
      "components/providers/ProviderMenuProfileWarmDishPreviewPanel.tsx",
    ].map((f) => path.join(ROOT, f));

    for (const filePath of presentationFiles) {
      const src = fs.readFileSync(filePath, "utf8");
      expect(src, rel(filePath)).not.toContain("lp_order_set");
      expect(src, rel(filePath)).not.toContain("menuDayPayload");
      expect(src, rel(filePath)).not.toContain("syncMenuServiceDayItems");
    }
  });

  test("protected runtime paths must not import G5d.1 runtimeMapping layer", () => {
    const protectedFiles = [
      ...filesUnderPrefixes(["app/api/provider/menu-days", "app/api/provider/menu-catalog"]),
      ...walkFiles(path.join(ROOT, "lib", "menu-publish")),
      ...filesUnderPrefixes([
        "app/(app)/week",
        "app/api/week",
        "app/api/order/window",
        "lib/week",
      ]),
      ...filesUnderPrefixes(["app/api/orders", "lib/orders"]),
      path.join(ROOT, "lib/provider-menu/menuDayPayload.ts"),
      path.join(ROOT, "lib/provider-menu/menuCatalogWrite.ts"),
      path.join(ROOT, "lib/provider-menu/varmrettSharedWrite.ts"),
    ].filter((p) => fs.existsSync(p));

    assertNoForbiddenImports(protectedFiles, [/runtimeMapping/]);
  });

  test("G5d.2 proposal UI may import runtimeMapping in provider menu presentation only", () => {
    const allowedProposalFiles = [
      path.join(ROOT, "app/leverandor/meny/page.tsx"),
      path.join(ROOT, "lib/provider-menu/providerMenuRuntimeMappingProposal.ts"),
    ].map((p) => fs.readFileSync(p, "utf8"));

    for (const src of allowedProposalFiles) {
      expect(src).toContain("runtimeMapping");
    }
  });

  test("G5d.2 proposal panel and view model must not import protected runtime paths", () => {
    const proposalUiFiles = [
      path.join(ROOT, "components/providers/ProviderMenuRuntimeMappingProposalPanel.tsx"),
      path.join(ROOT, "lib/provider-menu/providerMenuRuntimeMappingProposal.ts"),
    ];

    for (const filePath of proposalUiFiles) {
      const src = fs.readFileSync(filePath, "utf8");
      expect(src, rel(filePath)).not.toContain("lp_order_set");
      expect(src, rel(filePath)).not.toContain("menuDayPayload");
      expect(src, rel(filePath)).not.toContain("menuCatalogWrite");
      expect(src, rel(filePath)).not.toContain("syncMenuServiceDayItems");
      expect(src, rel(filePath)).not.toMatch(/from ["']@\/app\/api/);
      expect(src, rel(filePath)).not.toMatch(/from ["']react/);
    }
  });
});

describe("G5d.0 — Golden Path reference contracts unchanged", () => {
  test("pilot choice key paasmurt + item laks-eggerore display contract", () => {
    const line = formatProviderOrderItemLine({
      choiceLabel: "Påsmurt",
      variantTitle: "Laks & Eggerøre",
    });
    expect(line).toBe("Påsmurt · Laks & Eggerøre");
  });

  test("protected order set route still scopes provider menu gate", () => {
    const src = readSource("app/api/orders/set/route.ts");
    expect(src).toContain("assertEmployeeOrderBodyHasNoPricingOverrides");
    expect(src).not.toContain("warm-dish-preview:");
  });
});

describe("G5d.3c — mapping draft validation helper runtime separation", () => {
  const DRAFT_VALIDATION_IMPORT =
    /from\s+["']@\/lib\/menu-profile\/runtimeMappingDraftValidation/;

  const PROTECTED_PREFIXES = [
    "app/api/provider/menu-days",
    "app/api/provider/menu-catalog",
    "lib/menu-publish",
    "app/(app)/week",
    "app/api/week",
    "app/api/order/window",
    "lib/week",
    "app/api/orders",
    "lib/orders",
  ];

  const PROTECTED_FILES = [
    "lib/provider-menu/menuDayPayload.ts",
    "lib/provider-menu/menuCatalogWrite.ts",
    "lib/provider-menu/varmrettSharedWrite.ts",
    "lib/integrations/tripletex/tripletexEngine.ts",
  ];

  test("protected runtime paths must not import mapping draft validation helpers", () => {
    const files = [
      ...filesUnderPrefixes(PROTECTED_PREFIXES),
      ...PROTECTED_FILES.map((f) => path.join(ROOT, f)).filter((p) => fs.existsSync(p)),
    ];
    const offenders: string[] = [];
    for (const filePath of files) {
      const r = rel(filePath);
      if (r.includes(`${path.sep}tests${path.sep}`)) continue;
      const src = fs.readFileSync(filePath, "utf8");
      if (DRAFT_VALIDATION_IMPORT.test(src)) offenders.push(r);
    }
    expect(
      offenders,
      `draft validation helpers leaked into runtime:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("G5d.3c validation module is only imported from allowed paths", () => {
    const allowed = new Set([
      "lib/menu-profile/runtimeMappingDraftValidation.ts",
      "lib/menu-profile/runtimeMappingDraftValidationTypes.ts",
      "lib/menu-profile/runtimeMappingDraftPersistence.server.ts",
      "lib/menu-profile/runtimeMappingPublishShadow.server.ts",
      "app/api/provider/menu-profile/mapping-draft/route.ts",
      "app/api/provider/menu-profile/mapping-draft/archive/route.ts",
      "tests/lib/menu-profile/runtimeMappingDraftValidation.test.ts",
      "tests/lib/menu-profile/runtimeMappingDraftPersistence.server.test.ts",
      "tests/lib/menu-profile/runtimeMappingPublishShadow.test.ts",
      "tests/api/provider/menu-profile-mapping-draft-api.test.ts",
    ]);

    const allFiles = [
      ...walkFiles(path.join(ROOT, "app")),
      ...walkFiles(path.join(ROOT, "lib")),
      ...walkFiles(path.join(ROOT, "tests")),
    ];

    const offenders: string[] = [];
    for (const filePath of allFiles) {
      const r = rel(filePath);
      if (allowed.has(r.replace(/\\/g, "/"))) continue;
      const src = fs.readFileSync(filePath, "utf8");
      if (DRAFT_VALIDATION_IMPORT.test(src)) offenders.push(r);
    }
    expect(
      offenders,
      `unexpected draft validation imports:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("G5d.3b — mapping draft table runtime separation", () => {
  const DRAFT_TABLE = /provider_menu_profile_runtime_mapping_drafts/;

  const PROTECTED_PREFIXES = [
    "app/api/provider/menu-days",
    "app/api/provider/menu-catalog",
    "lib/menu-publish",
    "app/(app)/week",
    "app/api/week",
    "app/api/order/window",
    "lib/week",
    "app/api/orders",
    "lib/orders",
  ];

  const PROTECTED_FILES = [
    "lib/provider-menu/menuDayPayload.ts",
    "lib/provider-menu/menuCatalogWrite.ts",
    "lib/provider-menu/varmrettSharedWrite.ts",
    "lib/integrations/tripletex/tripletexEngine.ts",
  ];

  test("protected runtime paths must not reference mapping draft table", () => {
    const files = [
      ...filesUnderPrefixes(PROTECTED_PREFIXES),
      ...PROTECTED_FILES.map((f) => path.join(ROOT, f)).filter((p) => fs.existsSync(p)),
    ];
    const offenders: string[] = [];
    for (const filePath of files) {
      const r = rel(filePath);
      if (r.includes(`${path.sep}tests${path.sep}`)) continue;
      const src = fs.readFileSync(filePath, "utf8");
      if (DRAFT_TABLE.test(src)) offenders.push(r);
    }
    expect(offenders, `draft table leaked into runtime:\n${offenders.join("\n")}`).toEqual([]);
  });

  test("G5d.3b migration is the only runtime source file naming the draft table", () => {
    const migration = readSource(
      "supabase/migrations/20260727120000_provider_menu_profile_runtime_mapping_drafts.sql",
    );
    expect(DRAFT_TABLE.test(migration)).toBe(true);

    const allowedDraftTablePaths = new Set([
      "lib/menu-profile/runtimeMappingDraftPersistence.server.ts",
      "app/api/provider/menu-profile/mapping-draft/route.ts",
      "app/api/provider/menu-profile/mapping-draft/archive/route.ts",
    ].map((p) => p.replace(/\//g, path.sep)));

    const appFiles = walkFiles(path.join(ROOT, "app")).filter(
      (p) => !p.includes(`${path.sep}tests${path.sep}`),
    );
    const libRuntimeFiles = [
      ...walkFiles(path.join(ROOT, "lib", "menu-publish")),
      ...walkFiles(path.join(ROOT, "lib", "provider-menu")),
      ...walkFiles(path.join(ROOT, "lib", "orders")),
      ...walkFiles(path.join(ROOT, "lib", "menu-profile")).filter(
        (p) => !p.includes("runtimeMappingDraftPersistence.server"),
      ),
    ];
    const offenders: string[] = [];
    for (const filePath of [...appFiles, ...libRuntimeFiles]) {
      const r = rel(filePath);
      if (r.includes("providerMenuProfileRuntimeMappingDraftsMigration")) continue;
      if (allowedDraftTablePaths.has(r)) continue;
      const src = fs.readFileSync(filePath, "utf8");
      if (DRAFT_TABLE.test(src)) offenders.push(r);
    }
    expect(offenders).toEqual([]);
  });
});

describe("G5d.3d — mapping draft API runtime separation", () => {
  const DRAFT_PERSISTENCE_IMPORT =
    /from\s+["']@\/lib\/menu-profile\/runtimeMappingDraftPersistence\.server/;

  const PROTECTED_PREFIXES = [
    "app/api/provider/menu-days",
    "app/api/provider/menu-catalog",
    "lib/menu-publish",
    "app/(app)/week",
    "app/api/week",
    "app/api/order/window",
    "lib/week",
    "app/api/orders",
    "lib/orders",
  ];

  const PROTECTED_FILES = [
    "lib/provider-menu/menuDayPayload.ts",
    "lib/provider-menu/menuCatalogWrite.ts",
    "lib/provider-menu/varmrettSharedWrite.ts",
    "lib/integrations/tripletex/tripletexEngine.ts",
    "components/providers/ProviderMenuBuilder.tsx",
    "components/providers/ProviderMenuRuntimeMappingProposalPanel.tsx",
  ];

  test("protected runtime paths must not import draft persistence helper", () => {
    const files = [
      ...filesUnderPrefixes(PROTECTED_PREFIXES),
      ...PROTECTED_FILES.map((f) => path.join(ROOT, f)).filter((p) => fs.existsSync(p)),
    ];
    const offenders: string[] = [];
    for (const filePath of files) {
      const r = rel(filePath);
      if (r.includes(`${path.sep}tests${path.sep}`)) continue;
      const src = fs.readFileSync(filePath, "utf8");
      if (DRAFT_PERSISTENCE_IMPORT.test(src)) offenders.push(r);
    }
    expect(
      offenders,
      `draft persistence leaked into runtime:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  test("draft API routes must not import publish/order/week/Sanity/billing", () => {
    const apiFiles = [
      path.join(ROOT, "app/api/provider/menu-profile/mapping-draft/route.ts"),
      path.join(ROOT, "app/api/provider/menu-profile/mapping-draft/archive/route.ts"),
    ].filter((p) => fs.existsSync(p));

    const forbidden = [
      /menu-publish/,
      /lp_order_set/,
      /syncMenuServiceDay/,
      /requireSanityWrite/,
      /tripletex/i,
      /provider_price_rules/,
    ];

    for (const filePath of apiFiles) {
      const src = fs.readFileSync(filePath, "utf8");
      for (const pattern of forbidden) {
        expect(src, rel(filePath)).not.toMatch(pattern);
      }
    }
  });
});

describe("G5d.3e — mapping draft save UI runtime separation", () => {
  const DRAFT_SAVE_UI_FILES = [
    "components/providers/ProviderMenuRuntimeMappingDraftSaveControls.tsx",
    "components/providers/ProviderMenuRuntimeMappingProposalPanel.tsx",
    "lib/provider-menu/providerMenuRuntimeMappingDraftSavePayload.ts",
  ].map((f) => path.join(ROOT, f));

  const FORBIDDEN_IMPORTS = [
    /runtimeMappingDraftPersistence\.server/,
    /menu-publish/,
    /lp_order_set/,
    /syncMenuServiceDay/,
    /requireSanityWrite/,
    /tripletex/i,
  ];

  const FORBIDDEN_CTA_WORDS = [
    "Aktiver",
    "Send til ansatte",
    "Gjør live",
    "Bruk i meny",
    "Apply",
    "Enable",
  ];

  test("draft save UI files do not import server persistence or protected runtime paths", () => {
    for (const filePath of DRAFT_SAVE_UI_FILES) {
      if (!fs.existsSync(filePath)) continue;
      const src = fs.readFileSync(filePath, "utf8");
      for (const pattern of FORBIDDEN_IMPORTS) {
        expect(src, rel(filePath)).not.toMatch(pattern);
      }
    }
  });

  test("draft save nb copy avoids forbidden CTA words in save control strings", () => {
    const nb = readSource("messages/nb.json");
    const block = nb.slice(nb.indexOf('"draftSave"'), nb.indexOf('"catalogModel"'));
    expect(block).toContain("Lagre vurdering som utkast");
    for (const word of FORBIDDEN_CTA_WORDS) {
      expect(block, `forbidden CTA: ${word}`).not.toMatch(new RegExp(`\\b${word}\\b`, "i"));
    }
  });

  test("leverandor/meny page wires draft save flags without API route imports in client components", () => {
    const page = readSource("app/leverandor/meny/page.tsx");
    expect(page).toContain("isMenuProfileMappingDraftSaveUiEnabled");
    expect(page).toContain("canSaveMappingDraft");
    expect(page).toContain("mappingDraftSaveEnabled");
    const controls = readSource("components/providers/ProviderMenuRuntimeMappingDraftSaveControls.tsx");
    expect(controls).not.toContain("providerId");
    expect(controls).not.toMatch(/body:\s*JSON\.stringify\([\s\S]*providerId/);
  });
});

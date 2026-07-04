import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  formatProviderOrderItemLine,
  buildKitchenOrderItemDisplay,
} from "@/lib/providers/kitchenOrderDisplay";

const ROOT = process.cwd();

/**
 * Pilot reference — fixtures/tests only, never required in runtime source.
 *
 * This remains valid as a Norwegian pilot fixture, but it is no longer the
 * global product contract. SUPERSMART menu profile runtime may change display
 * labels per provider market/profile, while order identity must remain stable.
 */
const PILOT_REFERENCE = {
  choiceKey: "paasmurt",
  itemKey: "laks-eggerore",
  variantTitle: "Laks & Eggerøre",
  choiceLabel: "Påsmurt",
  displayLine: "Påsmurt · Laks & Eggerøre",
  orderDate: "2026-06-16",
};

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function exists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath));
}

function walkDir(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;

  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);

    if (ent.isDirectory()) {
      if (
        ent.name === "node_modules" ||
        ent.name === ".next" ||
        ent.name === ".git" ||
        ent.name === "coverage" ||
        ent.name === "playwright-report"
      ) {
        continue;
      }

      walkDir(p, out);
      continue;
    }

    if (/\.(ts|tsx|js|jsx|mjs)$/.test(ent.name)) {
      out.push(p);
    }
  }

  return out;
}

describe("Protected Golden Path — order identity and write-path locks", () => {
  it("1. /api/week route resolves employee company/location scope and provider menu scope", () => {
    const src = readSource("app/api/week/route.ts");

    expect(src).toContain("resolveProviderMenuScopeForCompany");
    expect(src).toContain("resolveEmployeeWeekScope");
    expect(src).toContain("companyId");
    expect(src).toContain("locationId");
  });

  it("2. order set route scopes menu gate to provider slug, not global menu", () => {
    const src = readSource("app/api/orders/set/route.ts");

    expect(src).toContain("resolveProviderMenuScopeForCompany");
    expect(src).toContain("getPublishedMenuForDate");
    expect(src).toContain("lp_order_set");
  });

  it("3. company order eligibility gate exists before lp_order_set", () => {
    const src = readSource("lib/orders/companyOrderEligibility.ts");
    const setRoute = readSource("app/api/orders/set/route.ts");

    expect(src).toContain("assertCompanyOrderWriteAllowed");
    expect(setRoute).toContain("assertCompanyOrderWriteAllowed");
  });

  it("4. lp_order_set wrapper remains centralized in rpcWrite", () => {
    const src = readSource("lib/orders/rpcWrite.ts");

    expect(src).toContain("lp_order_set");
  });

  it("5. provider kitchen loader filters by provider_id and never writes orders", () => {
    const src = readSource("lib/providers/loadKitchenOrders.ts");

    expect(src).toContain('.eq("provider_id"');
    expect(src).not.toContain("lp_order_set");
  });

  it("6. provider order card shows employee + displayLine, not raw item_key", () => {
    const card = readSource("components/providers/KitchenOrderCard.tsx");

    expect(card).toContain("employeeDisplayName");
    expect(card).toContain("employeeEmail");
    expect(card).toContain("displayLine");
    expect(card).not.toMatch(/\bitem_key\b/);
  });

  it("7. Norwegian pilot category + variant display line still matches proven shape", () => {
    expect(
      formatProviderOrderItemLine({
        choiceLabel: PILOT_REFERENCE.choiceLabel,
        variantTitle: PILOT_REFERENCE.variantTitle,
      }),
    ).toBe(PILOT_REFERENCE.displayLine);

    const item = buildKitchenOrderItemDisplay({
      productNameSnapshot: "Paasmurt",
      quantity: 1,
      choice: {
        choiceKey: PILOT_REFERENCE.choiceKey,
        itemKey: PILOT_REFERENCE.itemKey,
        itemTitleSnapshot: PILOT_REFERENCE.variantTitle,
      },
    });

    expect(item.displayLine).toBe(PILOT_REFERENCE.displayLine);
  });

  it("8. cutoff helpers remain wired in protected order surfaces", () => {
    const cutoffLib = readSource("lib/cutoff.ts");
    const immutability = readSource("lib/orders/immutability.ts");
    const orderWindow = readSource("app/api/order/window/route.ts");

    expect(cutoffLib).toContain("assertBeforeCutoffForDeliveryDate");
    expect(immutability).toContain("cutoffStatusForDate0805");
    expect(orderWindow).toContain("cutoffStatusForDate");
  });

  it("9. menu day provider resolver has no Melhus fallback constant in source", () => {
    const src = readSource("lib/menu-publish/resolveMenuDayProvider.ts");

    expect(src).not.toMatch(
      /Melhus Catering|melhus-catering|11111111-1111-1111-1111-111111111111/,
    );
    expect(src).toContain("MISSING_PROVIDER_REF");
  });

  it("10. no hardcoded Pettersen/Melhus pilot identity in app/ or lib/ runtime", () => {
    const runtimeRoots = ["app", "lib"].map((d) => path.join(ROOT, d));
    const forbidden = [
      "thomas@pettersenco.no",
      "Pettersen&Co",
      "pettersenco.no",
      "laks-eggerore",
    ];

    for (const root of runtimeRoots) {
      for (const file of walkDir(root)) {
        const rel = path.relative(ROOT, file).replace(/\\/g, "/");

        if (
          rel.includes("/tests/") ||
          rel.endsWith(".test.ts") ||
          rel.endsWith(".test.tsx")
        ) {
          continue;
        }

        if (rel.includes("__lint_probe__")) continue;
        if (!fs.existsSync(file)) continue;

        const text = fs.readFileSync(file, "utf8");

        for (const needle of forbidden) {
          expect(text, `${rel} must not hardcode pilot fixture "${needle}"`).not.toContain(
            needle,
          );
        }
      }
    }
  });

  it("11. menu materialization sync targets menu_service_days/items", () => {
    const syncDays = readSource("lib/menu-publish/syncMenuServiceDaysFromMenuDay.ts");
    const syncItems = readSource("lib/menu-publish/syncMenuServiceDayItems.ts");

    expect(syncDays).toMatch(/menu_service_days/);
    expect(syncItems).toMatch(/menu_service_day_items/);
  });

  it("12. duplicate order contract is documented in idempotency test suite", () => {
    expect(exists("tests/api/orders-idempotency.test.ts")).toBe(true);

    const src = readSource("tests/api/orders-idempotency.test.ts");
    expect(src).toContain("DUPLICATE_ORDER");
  });

  it("13. provider production advance uses scoped batch_derived_advance GUC inside lp_order_advance_status", () => {
    const migrationPath =
      "supabase/migrations/20260616110410_lp_order_advance_status_provider_after_cutoff.sql";

    expect(exists(migrationPath)).toBe(true);

    const sql = readSource(migrationPath);

    expect(sql).toContain("set_config('app.batch_derived_advance', '1', true)");
    expect(sql).toContain("lp_assert_provider_kitchen_access");
    expect(sql).not.toContain("DISABLE TRIGGER");
    expect(sql).not.toContain("lp_order_set");
  });

  it("14. provider production status labels cover full proven flow", () => {
    const src = readSource("lib/providers/kitchenOrderStatus.ts");

    expect(src).toContain("kitchenStatusLabelKey");
    expect(src).toContain("targetActionLabelKey");
    expect(src).toContain('"startProduction"');
    expect(src).toContain('"readyForDelivery"');
    expect(src).toContain('"markDelivered"');
    expect(src).toContain('"received"');
    expect(src).toContain('"inProduction"');
    expect(src).toContain('"delivered"');

    const nb = JSON.parse(fs.readFileSync("messages/nb.json", "utf8")) as {
      provider: {
        orders: {
          status: Record<string, string>;
          actions: Record<string, string>;
        };
      };
    };

    expect(nb.provider.orders.status.received).toBe("Mottatt");
    expect(nb.provider.orders.status.inProduction).toBe("I produksjon");
    expect(nb.provider.orders.status.readyForDelivery).toBe("Klar for levering");
    expect(nb.provider.orders.status.delivered).toBe("Levert");
    expect(nb.provider.orders.actions.startProduction).toBe("Start produksjon");
    expect(nb.provider.orders.actions.readyForDelivery).toBe("Klar for levering");
    expect(nb.provider.orders.actions.markDelivered).toBe("Marker levert");
  });

  it("15. provider order enrichment module scopes rows to provider-visible orders", () => {
    const src = readSource("lib/providers/providerOrderEnrichment.ts");

    expect(src).toContain("scopedOrderIds");
    expect(src).toContain("ingestScopedOrderItemRow");
    expect(src).not.toContain("lp_order_set");
  });

  it("16. provider status RPC wrapper calls lp_order_advance_status only", () => {
    const src = readSource("lib/admin/orderStatus.ts");

    expect(src).toContain('rpc("lp_order_advance_status"');
    expect(src).not.toContain("lp_order_set");
  });

  it("17. kitchen card advances via advanceKitchenOrder server action", () => {
    const card = readSource("components/providers/KitchenOrderCard.tsx");
    const actions = readSource("app/leverandor/ordrer/actions.ts");

    expect(card).toContain("advanceKitchenOrder");
    expect(actions).toContain("advanceOrderStatus");
    expect(actions).toContain("hasProviderRole");
  });

  it("18. provider production status flow regression suite exists", () => {
    expect(exists("tests/providers/providerProductionStatusFlow.test.ts")).toBe(true);
    expect(exists("tests/providers/providerProductionCutoff.test.ts")).toBe(true);
  });
});

describe("Protected Golden Path — SMART-1 additive migration metadata", () => {
  const SMART1_MIGRATION = "supabase/migrations/20260728120000_menu_content_translations.sql";

  it("menu_content_translations migration is additive metadata only", () => {
    expect(exists(SMART1_MIGRATION)).toBe(true);

    const sql = readSource(SMART1_MIGRATION);

    expect(sql).toMatch(/menu_content_translations/);
    expect(sql).toMatch(/Not read by employee runtime/i);
    expect(sql).not.toMatch(/lp_order_set/);
    expect(sql).not.toMatch(/menuDayPayload/);
    expect(sql).not.toMatch(/syncMenuServiceDayItems/);

    for (const route of ["app/api/week/route.ts", "app/api/orders/set/route.ts"]) {
      const src = readSource(route);
      expect(src, `${route} must not reference menu_content_translations`).not.toMatch(
        /menu_content_translations/,
      );
    }

    const windowRoute = readSource("app/api/order/window/route.ts");

    expect(windowRoute).toContain("overlayApprovedTranslationsOnOrderWindowDays");
    expect(windowRoute).not.toMatch(/\bfrom\(["']menu_content_translations["']\)/);
    expect(windowRoute).not.toMatch(/approved_by|approved_at|translated_text/);

    expect(readSource("lib/orders/rpcWrite.ts")).not.toMatch(/menu_content_translations/);
  });
});

describe("Protected Golden Path — SMART-2 provider approval remains provider-scoped", () => {
  const SMART2_PATHS = [
    "app/api/provider/menu-translations/route.ts",
    "app/api/provider/menu-translations/[id]/route.ts",
    "lib/smart-menu/providerTranslationApproval.ts",
  ] as const;

  it("SMART-2 provider approval stays provider-scoped and does not write employee orders", () => {
    for (const rel of SMART2_PATHS) {
      const src = readSource(rel);

      expect(src).not.toMatch(/lp_order_set/);
      expect(src).not.toMatch(/menuDayPayload/);
      expect(src).not.toMatch(/app\/\(app\)\/week/);
      expect(src).toMatch(/employeeTranslationsLive:\s*false|employeeVisible:\s*false/);
    }

    for (const route of ["app/api/week/route.ts", "app/api/orders/route.ts"]) {
      expect(readSource(route)).not.toMatch(/menu_content_translations/);
    }
  });
});

describe("Protected Golden Path — SMART-3 employee translation overlay", () => {
  it("SMART-3 overlay is display-only and order identity/write path remain unchanged", () => {
    const overlay = readSource("lib/smart-menu/employeeApprovedTranslations.ts");

    expect(overlay).toContain("isEmployeeVisibleTranslation");
    expect(overlay).not.toMatch(/lp_order_set/);
    expect(overlay).not.toMatch(/menuDayPayload/);
    expect(overlay).not.toMatch(/rpc\(["']lp_order_set["']\)/);

    const windowRoute = readSource("app/api/order/window/route.ts");

    expect(windowRoute).toContain("overlayApprovedTranslationsOnOrderWindowDays");
    expect(windowRoute).not.toMatch(/\bfrom\(["']menu_content_translations["']\)/);

    for (const rel of [
      "lib/orders/rpcWrite.ts",
      "lib/orders/resolveOrderDayItemPersist.ts",
      "app/api/orders/set/route.ts",
    ]) {
      expect(readSource(rel)).not.toMatch(/employeeApprovedTranslations/);
    }

    const weekClient = readSource("app/(app)/week/EmployeeWeekClient.tsx");

    expect(weekClient).toMatch(/choice_key|itemKey/);
    expect(weekClient).not.toMatch(/translated_text/);
  });
});

describe("Protected Golden Path — SUPERSMART provider menu profile runtime", () => {
  function findSourceContaining(roots: string[], needle: string): string {
    for (const root of roots) {
      const absRoot = path.join(ROOT, root);

      for (const file of walkDir(absRoot)) {
        const text = fs.readFileSync(file, "utf8");

        if (text.includes(needle)) return text;
      }
    }

    throw new Error(`Could not find source containing "${needle}" in ${roots.join(", ")}`);
  }

  it("menu profile storage and mapping are explicit, provider-scoped, and cover all 9 supported locales", () => {
    expect(exists("lib/menu-profile/localeMenuProfileMapping.ts")).toBe(true);

    const mapping = readSource("lib/menu-profile/localeMenuProfileMapping.ts");
    const registry = readSource("lib/menu-profile/registry.ts");

    for (const expected of [
      "norwegian_company_lunch",
      "danish_office_lunch",
      "german_business_lunch",
      "uk_office_lunch",
      "spanish_menu_del_dia",
      "french_dejeuner",
      "italian_office_lunch",
      "finnish_office_lunch",
      "swedish_lunch",
    ]) {
      expect(`${mapping}\n${registry}`, `missing supported menu profile "${expected}"`).toContain(
        expected,
      );
    }

    const save = readSource("lib/providers/saveProviderOperationalSettings.ts");

    expect(save).toContain("menu_profile_id");
    expect(save).toContain("default_country_code");
    expect(save).toContain("default_currency");
    expect(save).toContain("hasProviderRole");
  });

  it("provider menu profile runtime is flag-gated and all 9 markets have runtime label coverage", () => {
    expect(exists("lib/menu-profile/profileMenuRuntime.ts")).toBe(true);

    const runtime = readSource("lib/menu-profile/profileMenuRuntime.ts");
    const mapping = readSource("lib/menu-profile/localeMenuProfileMapping.ts");
    const registry = readSource("lib/menu-profile/registry.ts");
    const flagSource = findSourceContaining(
      ["lib", "app", "components"],
      "LP_MENU_PROFILE_RESOLVER",
    );

    expect(flagSource).toContain("LP_MENU_PROFILE_RESOLVER");
    expect(runtime).toMatch(/LP_MENU_PROFILE_RESOLVER|resolveActiveMenuProfileForRuntime/);

    for (const market of ["NO", "DK", "DE", "UK", "ES", "FR", "IT", "FI", "SE"]) {
      expect(runtime, `profile runtime must cover market "${market}"`).toContain(`${market}:`);
    }

    for (const profileId of [
      "norwegian_company_lunch",
      "danish_office_lunch",
      "german_business_lunch",
      "uk_office_lunch",
      "spanish_menu_del_dia",
      "french_dejeuner",
      "italian_office_lunch",
      "finnish_office_lunch",
      "swedish_lunch",
    ]) {
      expect(
        `${mapping}\n${registry}`,
        `mapping/registry must cover profile "${profileId}"`,
      ).toContain(profileId);
    }

    expect(runtime).toMatch(/choice_key|choiceKey|category|Category/);
    expect(runtime).not.toMatch(/lp_order_set/);
  });

  it("provider menu workspace may use profile labels without changing keys or resetting catalog", () => {
    const workspace = readSource("lib/provider-menu/providerMenuWorkspace.ts");
    const catalog = readSource("lib/provider-menu/lunchCategoryCatalog.ts");

    expect(workspace).toMatch(/profileCategoryLabels|buildProfileRuntimeCategoryLabels/);
    expect(catalog).toContain("profileCategoryLabels");

    expect(catalog).toMatch(/if\s*\(\s*title\s*\)\s*return\s+title/);
    expect(catalog).not.toMatch(/createOrReplace|delete\(|mutate\(/);
    expect(workspace).not.toMatch(/createOrReplace|delete\(|mutate\(/);
  });

  it("employee order window may apply provider profile label overlay, but identity and write path remain unchanged", () => {
    const windowRoute = readSource("app/api/order/window/route.ts");

    expect(windowRoute).toContain("loadAndResolveProviderMenuProfile");
    expect(windowRoute).toContain("resolveActiveMenuProfileForRuntime");
    expect(windowRoute).toContain("overlayProfileLabelsOnOrderWindowCategories");
    expect(windowRoute).toContain("overlayApprovedTranslationsOnOrderWindowDays");

    const profileOverlayCallIndex = windowRoute.indexOf(
      "overlayProfileLabelsOnOrderWindowCategories(",
    );
    const approvedOverlayCallIndex = windowRoute.indexOf(
      "overlayApprovedTranslationsOnOrderWindowDays({",
    );

    expect(profileOverlayCallIndex).toBeGreaterThanOrEqual(0);
    expect(approvedOverlayCallIndex).toBeGreaterThanOrEqual(0);
    expect(profileOverlayCallIndex).toBeLessThan(approvedOverlayCallIndex);

    expect(windowRoute).not.toMatch(/lp_order_set/);
    expect(windowRoute).not.toMatch(/rpc\(["']lp_order_set["']\)/);
    expect(windowRoute).not.toMatch(/commission|provision|invoice|mva|vat/i);
    expect(windowRoute).not.toMatch(/approved_by|approved_at|translated_text/);
  });

  it("employee locale must not override provider menu profile", () => {
    const windowRoute = readSource("app/api/order/window/route.ts");

    expect(windowRoute).toContain("loadAndResolveProviderMenuProfile");
    expect(windowRoute).toContain("menuScope.providerId");
    expect(windowRoute).toContain("overlayApprovedTranslationsOnOrderWindowDays");

    const profileResolverCallIndex = windowRoute.indexOf("loadAndResolveProviderMenuProfile(");
    const translationOverlayCallIndex = windowRoute.indexOf(
      "overlayApprovedTranslationsOnOrderWindowDays({",
    );

    expect(profileResolverCallIndex).toBeGreaterThanOrEqual(0);
    expect(translationOverlayCallIndex).toBeGreaterThanOrEqual(0);
    expect(profileResolverCallIndex).toBeLessThan(translationOverlayCallIndex);

    expect(windowRoute).not.toMatch(/resolveActiveMenuProfileForRuntime\([^)]*locale/);
    expect(windowRoute).not.toMatch(/loadAndResolveProviderMenuProfile\([^)]*employee/);
  });

  it("profile warm dish bank can exist as deterministic suggestions without mutating live generation", () => {
    const runtime = readSource("lib/menu-profile/profileMenuRuntime.ts");

    expect(runtime).toMatch(/buildProfileWarmDishSuggestions|profileWarmDishSuggestions/);
    expect(runtime).toMatch(/isPreviewOnly:\s*true|preview/i);
    expect(runtime).not.toMatch(/openai|anthropic|chatCompletion|generateObject/i);

    const possibleGenerationFiles = [
      "lib/provider-menu/generateWeekMenu.ts",
      "lib/provider-menu/profileWarmDishGeneration.ts",
      "lib/provider-menu/varmrettSharedWrite.ts",
      "lib/provider-menu/varmrettSharedRead.ts",
      "app/api/provider/menu-days/varmrett/generate/route.ts",
      "app/api/provider/menu-days/varmrett/suggestions/route.ts",
    ].filter(exists);

    for (const rel of possibleGenerationFiles) {
      const src = readSource(rel);

      expect(src, `${rel} must not call lp_order_set`).not.toMatch(/lp_order_set/);
      expect(src, `${rel} must not mutate Sanity schema`).not.toMatch(/schemaTypes|defineType/);
    }
  });

  it("SUPERSMART profile runtime does not weaken commercial or metadata boundaries", () => {
    const employeeSurfaces = [
      "app/api/order/window/route.ts",
      "app/(app)/week/EmployeeWeekClient.tsx",
    ];

    for (const rel of employeeSurfaces) {
      const src = readSource(rel);

      expect(src, `${rel} must not expose commercial fields`).not.toMatch(
        /commission|provision|invoice|vat|mva|default_currency|defaultCurrency|priceRule|provider_price/i,
      );

      expect(src, `${rel} must not expose translation approval metadata`).not.toMatch(
        /approved_by|approved_at|translated_text|original_text_hash/,
      );
    }
  });
});
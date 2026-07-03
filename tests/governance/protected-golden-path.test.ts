import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  formatProviderOrderItemLine,
  buildKitchenOrderItemDisplay,
} from "@/lib/providers/kitchenOrderDisplay";

const ROOT = process.cwd();

/** Pilot reference — fixtures/tests only, never required in runtime source. */
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

function walkDir(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walkDir(p, out);
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

describe("Protected Golden Path — contract locks (no runtime changes)", () => {
  it("1. /api/week route resolves employee company/location scope and provider menu scope", () => {
    const src = readSource("app/api/week/route.ts");
    expect(src).toContain("resolveProviderMenuScopeForCompany");
    expect(src).toContain("resolveEmployeeWeekScope");
    expect(src).toContain("companyId");
    expect(src).toContain("locationId");
  });

  it("2. order set route scopes menu gate to provider slug (not global menu)", () => {
    const src = readSource("app/api/orders/set/route.ts");
    expect(src).toContain("resolveProviderMenuScopeForCompany");
    expect(src).toContain("getPublishedMenuForDate");
    expect(src).toContain("lp_order_set");
  });

  it("3. company order eligibility gate exists before lp_order_set", () => {
    const src = readSource("lib/orders/companyOrderEligibility.ts");
    expect(src).toContain("assertCompanyOrderWriteAllowed");
    const setRoute = readSource("app/api/orders/set/route.ts");
    expect(setRoute).toContain("assertCompanyOrderWriteAllowed");
  });

  it("4. lp_order_set wrapper remains centralized in rpcWrite", () => {
    const src = readSource("lib/orders/rpcWrite.ts");
    expect(src).toContain("lp_order_set");
  });

  it("5. provider kitchen loader filters by provider_id (wrong provider isolation)", () => {
    const src = readSource("lib/providers/loadKitchenOrders.ts");
    expect(src).toContain('.eq("provider_id"');
    expect(src).not.toContain("lp_order_set");
  });

  it("6. provider order card shows employee + displayLine (not raw item_key)", () => {
    const card = readSource("components/providers/KitchenOrderCard.tsx");
    expect(card).toContain("employeeDisplayName");
    expect(card).toContain("employeeEmail");
    expect(card).toContain("displayLine");
    expect(card).not.toMatch(/\bitem_key\b/);
  });

  it("7. pilot category + variant display line matches proven shape", () => {
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
    expect(cutoffLib).toContain("assertBeforeCutoffForDeliveryDate");
    const immutability = readSource("lib/orders/immutability.ts");
    expect(immutability).toContain("cutoffStatusForDate0805");
    const orderWindow = readSource("app/api/order/window/route.ts");
    expect(orderWindow).toContain("cutoffStatusForDate");
  });

  it("9. menu day provider resolver has no Melhus fallback constant in source", () => {
    const src = readSource("lib/menu-publish/resolveMenuDayProvider.ts");
    expect(src).not.toMatch(/Melhus Catering|melhus-catering|11111111-1111-1111-1111-111111111111/);
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
        if (rel.includes("/tests/") || rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
        if (rel.includes("__lint_probe__")) continue;
        if (!fs.existsSync(file)) continue;
        const text = fs.readFileSync(file, "utf8");
        for (const needle of forbidden) {
          expect(text, `${rel} must not hardcode pilot fixture "${needle}"`).not.toContain(needle);
        }
      }
    }
  });

  it("11. menu materialization sync targets menu_service_days/items (source contract)", () => {
    const syncDays = readSource("lib/menu-publish/syncMenuServiceDaysFromMenuDay.ts");
    expect(syncDays).toMatch(/menu_service_days/);
    const syncItems = readSource("lib/menu-publish/syncMenuServiceDayItems.ts");
    expect(syncItems).toMatch(/menu_service_day_items/);
  });

  it("12. duplicate order contract documented in idempotency test suite", () => {
    expect(fs.existsSync(path.join(ROOT, "tests/api/orders-idempotency.test.ts"))).toBe(true);
    const src = readSource("tests/api/orders-idempotency.test.ts");
    expect(src).toContain("DUPLICATE_ORDER");
  });

  it("13. provider production advance uses scoped batch_derived_advance GUC inside lp_order_advance_status", () => {
    const migrationPath = path.join(
      ROOT,
      "supabase/migrations/20260616110410_lp_order_advance_status_provider_after_cutoff.sql",
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toContain("set_config('app.batch_derived_advance', '1', true)");
    expect(sql).toContain("lp_assert_provider_kitchen_access");
    expect(sql).not.toContain("DISABLE TRIGGER");
    expect(sql).not.toContain("lp_order_set");
  });

  it("14. provider production status labels cover full proven flow", async () => {
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
      provider: { orders: { status: Record<string, string>; actions: Record<string, string> } };
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
    expect(fs.existsSync(path.join(ROOT, "tests/providers/providerProductionStatusFlow.test.ts"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "tests/providers/providerProductionCutoff.test.ts"))).toBe(true);
  });
});

describe("Protected Golden Path — SMART-1 additive migration (metadata only)", () => {
  const SMART1_MIGRATION = "supabase/migrations/20260728120000_menu_content_translations.sql";

  it("menu_content_translations migration is additive metadata only — no Golden Path runtime wiring", () => {
    expect(fs.existsSync(path.join(ROOT, SMART1_MIGRATION))).toBe(true);
    const sql = readSource(SMART1_MIGRATION);
    expect(sql).toMatch(/menu_content_translations/);
    expect(sql).toMatch(/Not read by employee runtime/i);
    expect(sql).not.toMatch(/lp_order_set/);
    expect(sql).not.toMatch(/menuDayPayload/);
    expect(sql).not.toMatch(/syncMenuServiceDayItems/);
    for (const route of [
      "app/api/week/route.ts",
      "app/api/order/window/route.ts",
      "app/api/orders/set/route.ts",
    ]) {
      const src = readSource(route);
      expect(src, `${route} must not reference menu_content_translations`).not.toMatch(
        /menu_content_translations/,
      );
    }
    expect(readSource("lib/orders/rpcWrite.ts")).not.toMatch(/menu_content_translations/);
  });
});

describe("Protected Golden Path — SMART-2 provider approval (no employee/order wiring)", () => {
  const SMART2_PATHS = [
    "app/api/provider/menu-translations/route.ts",
    "app/api/provider/menu-translations/[id]/route.ts",
    "lib/smart-menu/providerTranslationApproval.ts",
  ] as const;

  it("SMART-2 provider approval stays provider-scoped — no Golden Path runtime wiring", () => {
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

describe("Protected Golden Path — SMART-3 employee display overlay only", () => {
  it("SMART-3 overlay is display-only — order identity and write path unchanged", () => {
    const overlay = readSource("lib/smart-menu/employeeApprovedTranslations.ts");
    expect(overlay).toContain("isEmployeeVisibleTranslation");
    expect(overlay).not.toMatch(/lp_order_set/);
    expect(overlay).not.toMatch(/menuDayPayload/);

    const windowRoute = readSource("app/api/order/window/route.ts");
    expect(windowRoute).toContain("overlayApprovedTranslationsOnOrderWindowDays");
    expect(windowRoute).not.toMatch(/\bmenu_content_translations\b/);

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

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
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildKitchenOrderItemDisplay } from "@/lib/providers/kitchenOrderDisplay";
import {
  buildAllowedDayChoiceKeys,
  ingestScopedDayChoiceRow,
  ingestScopedOrderItemRow,
  scopedOrderIdSet,
  type RawOrderItem,
} from "@/lib/providers/providerOrderEnrichment";

const LOADER_PATH = join(process.cwd(), "lib", "providers", "loadKitchenOrders.ts");
const ENRICHMENT_PATH = join(process.cwd(), "lib", "providers", "providerOrderEnrichment.ts");

const PETTERSEN_ORDER_ID = "f8570e3e-9a87-420f-9484-cf9516bf6e86";
const OTHER_ORDER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PETTERSEN_COMPANY = "907c0624-101d-49af-8ce3-44f1830172b0";
const PETTERSEN_LOCATION = "2da4147f-c9fa-4e94-9f43-c3d419ddd9cb";
const PETTERSEN_USER = "595efa42-0d20-49ab-9382-76028d119dc8";
const PETTERSEN_DATE = "2026-06-16";

describe("loadKitchenOrders provider scope", () => {
  it("keeps base orders query provider-scoped on session client", () => {
    const source = readFileSync(LOADER_PATH, "utf-8");
    expect(source).toContain('.eq("provider_id", pid)');
    expect(source).toContain("fetchProviderOrderEnrichment");
    expect(source).not.toContain("lp_order_set");
  });

  it("uses admin enrichment module after scoped order IDs are known", () => {
    const loader = readFileSync(LOADER_PATH, "utf-8");
    const enrichment = readFileSync(ENRICHMENT_PATH, "utf-8");
    expect(loader).toContain("fetchProviderOrderEnrichment");
    expect(enrichment).toContain("supabaseAdmin");
    expect(enrichment).toContain('.in("order_id", orderIds)');
    expect(enrichment).not.toContain("from(\"orders\")");
  });
});

describe("providerOrderEnrichment guards", () => {
  it("returns empty scoped set when no order IDs", () => {
    expect(scopedOrderIdSet([]).size).toBe(0);
  });

  it("drops order_items for unknown order_id", () => {
    const scoped = scopedOrderIdSet([PETTERSEN_ORDER_ID]);
    const itemsByOrder = new Map<string, RawOrderItem[]>();

    ingestScopedOrderItemRow(itemsByOrder, scoped, {
      order_id: PETTERSEN_ORDER_ID,
      product_name_snapshot: "Paasmurt",
      quantity: 1,
      allergens_snapshot: [],
    });
    ingestScopedOrderItemRow(itemsByOrder, scoped, {
      order_id: OTHER_ORDER_ID,
      product_name_snapshot: "Other",
      quantity: 1,
      allergens_snapshot: [],
    });

    expect(itemsByOrder.size).toBe(1);
    expect(itemsByOrder.has(PETTERSEN_ORDER_ID)).toBe(true);
    expect(itemsByOrder.has(OTHER_ORDER_ID)).toBe(false);
  });

  it("keeps day_choices only for allowed scope keys", () => {
    const allowed = buildAllowedDayChoiceKeys([
      {
        company_id: PETTERSEN_COMPANY,
        location_id: PETTERSEN_LOCATION,
        user_id: PETTERSEN_USER,
        date: PETTERSEN_DATE,
      },
    ]);
    const dayChoiceMap = new Map();

    ingestScopedDayChoiceRow(dayChoiceMap, allowed, {
      company_id: PETTERSEN_COMPANY,
      location_id: PETTERSEN_LOCATION,
      user_id: PETTERSEN_USER,
      date: PETTERSEN_DATE,
      choice_key: "paasmurt",
      item_key: "laks-eggerore",
      item_title_snapshot: null,
      note: null,
      updated_at: "2026-06-15T10:29:47.929711+00:00",
    });

    ingestScopedDayChoiceRow(dayChoiceMap, allowed, {
      company_id: "other-company",
      location_id: PETTERSEN_LOCATION,
      user_id: PETTERSEN_USER,
      date: PETTERSEN_DATE,
      choice_key: "paasmurt",
      item_key: "other",
      item_title_snapshot: null,
      note: null,
      updated_at: "2026-06-15T10:29:47.929711+00:00",
    });

    expect(dayChoiceMap.size).toBe(1);
  });
});

describe("Pettersen display contract", () => {
  it("builds expected line from order_items + day_choices", () => {
    const lookup = new Map<string, string>([["paasmurt:laks-eggerore", "Laks & Eggerøre"]]);
    const item = buildKitchenOrderItemDisplay({
      productNameSnapshot: "Paasmurt",
      quantity: 1,
      choice: {
        choiceKey: "paasmurt",
        itemKey: "laks-eggerore",
        itemTitleSnapshot: null,
      },
      variantLookup: lookup,
    });

    expect(item.displayLine).toBe("Påsmurt · Laks & Eggerøre");
    expect(item.displayLine).not.toContain("laks-eggerore");
  });

  it("falls back to day_choices-only line when order_items missing", () => {
    const lookup = new Map<string, string>([["paasmurt:laks-eggerore", "Laks & Eggerøre"]]);
    const item = buildKitchenOrderItemDisplay({
      productNameSnapshot: null,
      quantity: 1,
      choice: {
        choiceKey: "paasmurt",
        itemKey: "laks-eggerore",
        itemTitleSnapshot: null,
      },
      variantLookup: lookup,
    });

    expect(item.displayLine).toBe("Påsmurt · Laks & Eggerøre");
  });
});

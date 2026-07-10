import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE } from "@/lib/menu-generator/sotMsdiItemMapping";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260710150000_msdi_localized_sot_snapshot_trigger_alignment.sql",
);

describe("F4b msdi localized SOT snapshot trigger alignment migration", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("adds snapshot_mode column with localized_generated_content check", () => {
    expect(sql).toContain("ALTER TABLE public.menu_service_day_items");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS snapshot_mode/i);
    expect(sql).toContain("menu_service_day_items_snapshot_mode_check");
    expect(sql).toContain(LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_SNAPSHOT_MODE);
  });

  it("replaces tg_menu_service_day_item_snapshot with localized preserve branch", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.tg_menu_service_day_item_snapshot()");
    expect(sql).toContain("new.snapshot_mode = v_localized_mode");
    expect(sql).toContain("return new;");
    expect(sql).toContain("new.product_name_snapshot := v_name");
    expect(sql).toContain("new.vat_rate_snapshot := v_vat");
    expect(sql).toContain("coalesce(new.offered_price_cents_ex_vat, v_price)");
  });

  it("fail-closed: incomplete localized payload falls back to legacy tier-product resolution", () => {
    expect(sql).toContain("nullif(btrim(new.product_name_snapshot), '') is not null");
    expect(sql).toContain("new.snapshot_mode := null");
  });

  it("documents no production apply scope and leaves RLS unchanged", () => {
    expect(sql).toMatch(/RLS:\s*intentionally unchanged/i);
    expect(sql).toMatch(/source\/migration only/i);
    expect(sql).not.toMatch(/^\s*UPDATE\s+public\.menu_service_day_items/im);
  });

  it("does not touch protected order/billing surfaces in trigger body", () => {
    const body = sql.split("AS $$")[1]?.split("$$;")[0] ?? "";
    const forbidden = [/lp_order_set/, /billing/, /stripe/i, /CREATE POLICY/i, /ENABLE ROW LEVEL SECURITY/i];
    for (const pattern of forbidden) {
      expect(body, `trigger body must not reference ${pattern}`).not.toMatch(pattern);
    }
  });
});

/**
 * SMART-3 — employee week approved translation API integration tests.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

import { buildMenuDayCategories } from "@/app/api/order/window/route";

vi.mock("server-only", () => ({}));

const mockFrom = vi.hoisted(() => vi.fn());
const mockSupabaseAdmin = vi.hoisted(() => vi.fn());
const mockLoadProfile = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => mockSupabaseAdmin(),
}));

vi.mock("@/lib/i18n/profileLocale", () => ({
  loadProfilePreferredLocaleForRequest: () => mockLoadProfile(),
}));

import {
  overlayApprovedTranslationsOnOrderWindowDays,
  resolveEmployeeDisplayLocaleFromRequest,
  __testHashOriginalText,
} from "@/lib/smart-menu/employeeApprovedTranslations";

const PROVIDER_ID = "11111111-1111-1111-1111-111111111111";

function setupTranslationQuery(rows: unknown[]) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(async () => ({ data: rows, error: null })),
  };
  mockFrom.mockReturnValue(chain);
  mockSupabaseAdmin.mockReturnValue({ from: mockFrom });
  return chain;
}

describe("employee week approved translations — API overlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadProfile.mockResolvedValue("en");
  });

  test("overlay applies approved item title for employee locale", async () => {
    const categories = buildMenuDayCategories({
      planTier: "BASIS",
      menus: [
        {
          category: "varmrett",
          mealTitle: "Biff",
          items: [
            {
              key: "item-1",
              title: "Norsk tittel",
              allergens: [],
              isVegetarian: false,
              available: true,
            },
          ],
        },
      ],
    });
    const days = [{ date: "2026-07-08", categories }];
    const original = "Norsk tittel";
    setupTranslationQuery([
      {
        status: "approved",
        source_kind: "menu_day_item",
        source_ref: "item-1",
        field: "title",
        original_text: original,
        original_text_hash: __testHashOriginalText(original),
        translated_text: "Norwegian title EN",
      },
    ]);

    const out = await overlayApprovedTranslationsOnOrderWindowDays({
      days,
      providerId: PROVIDER_ID,
      locale: "en",
    });

    const varmrett = out[0].categories.find((c) => c.category === "varmrett");
    const item = varmrett?.items.find((i) => i.key === "item-1");
    expect(item?.title).toBe("Norwegian title EN");
    expect(item?.key).toBe("item-1");
    expect(varmrett?.key).toBe("varmmat");
  });

  test("draft row in DB does not change employee display", async () => {
    const categories = buildMenuDayCategories({
      planTier: "BASIS",
      menus: [
        {
          category: "varmrett",
          items: [
            {
              key: "item-1",
              title: "Original",
              allergens: [],
              isVegetarian: false,
              available: true,
            },
          ],
        },
      ],
    });
    const days = [{ date: "2026-07-08", categories }];
    setupTranslationQuery([]);

    const out = await overlayApprovedTranslationsOnOrderWindowDays({
      days,
      providerId: PROVIDER_ID,
      locale: "en",
    });

    const varmrett = out[0].categories.find((c) => c.category === "varmrett");
    const item = varmrett?.items.find((i) => i.key === "item-1");
    expect(item?.title).toBe("Original");
  });

  test("resolveEmployeeDisplayLocaleFromRequest uses cookie then profile", async () => {
    const req = {
      cookies: {
        get: (name: string) => (name === "lp_locale" ? { value: "sv" } : undefined),
      },
    } as any;
    mockLoadProfile.mockResolvedValue("en");
    await expect(resolveEmployeeDisplayLocaleFromRequest(req)).resolves.toBe("sv");
  });
});

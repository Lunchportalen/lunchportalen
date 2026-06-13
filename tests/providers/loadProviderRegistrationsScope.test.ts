// @ts-nocheck
// Bevis: provider-portalens registreringsliste er provider-scoped — kun rader
// med eksakt eq(provider_id) returneres, og globale provider_id NULL-rader
// (waitlist) kan aldri lekke til en provider_admin.
import { describe, test, expect, vi, beforeEach } from "vitest";

const PROVIDER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROVIDER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const ALL_ROWS = [
  { id: "reg-a", provider_id: PROVIDER_A, status: "PENDING", company_name: "A-kunde AS", created_at: "2026-06-10T10:00:00Z" },
  { id: "reg-b", provider_id: PROVIDER_B, status: "PENDING", company_name: "B-kunde AS", created_at: "2026-06-10T11:00:00Z" },
  { id: "reg-null", provider_id: null, status: "PENDING", company_name: "Waitlist AS", created_at: "2026-06-10T12:00:00Z" },
];

const probe: { filters: Array<[string, unknown]> } = { filters: [] };

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    from: (_table: string) => {
      const b: any = {
        select: () => b,
        order: () => b,
        limit: () => b,
        eq: (col: string, val: unknown) => {
          probe.filters.push([col, val]);
          return b;
        },
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: any) => {
          // Emulerer PostgREST eq-semantikk: NULL matcher aldri eq(uuid).
          let rows = ALL_ROWS;
          for (const [col, val] of probe.filters) {
            rows = rows.filter((r) => (r as any)[col] === val);
          }
          return resolve({ data: rows, error: null });
        },
      };
      return b;
    },
  }),
}));

describe("loadProviderRegistrations — provider-isolasjon", () => {
  beforeEach(() => {
    vi.resetModules();
    probe.filters = [];
  });

  test("provider A ser kun egne rader — aldri provider B eller provider_id NULL", async () => {
    const mod = await import("@/lib/providers/loadProviderRegistrations");
    const rows = await mod.loadProviderRegistrations(PROVIDER_A, "pending");

    expect(probe.filters).toContainEqual(["provider_id", PROVIDER_A]);
    expect(rows.map((r) => r.id)).toEqual(["reg-a"]);
    expect(rows.some((r) => r.provider_id === null)).toBe(false);
    expect(rows.some((r) => r.provider_id === PROVIDER_B)).toBe(false);
  });

  test("globale waitlist-rader (provider_id NULL) returneres aldri til en provider", async () => {
    const mod = await import("@/lib/providers/loadProviderRegistrations");
    const rowsA = await mod.loadProviderRegistrations(PROVIDER_A, "all");
    probe.filters = [];
    const rowsB = await mod.loadProviderRegistrations(PROVIDER_B, "all");

    expect(rowsA.every((r) => r.provider_id === PROVIDER_A)).toBe(true);
    expect(rowsB.every((r) => r.provider_id === PROVIDER_B)).toBe(true);
  });
});

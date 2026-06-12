import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deleteMenuServiceDaysForMenuDay,
  syncMenuServiceDaysForPublishedMenuDay,
} from "@/lib/menu-publish/syncMenuServiceDaysFromMenuDay";

const msdiMock = vi.fn();

vi.mock("@/lib/menu-publish/syncMenuServiceDayItems", () => ({
  syncMenuServiceDayItemsAfterMenuDayPublish: (...args: unknown[]) => msdiMock(...args),
}));

const PROVIDER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROVIDER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PROVIDER_C = "cccccccc-cccc-cccc-cccc-cccccccccccc";

/** Mandag (agreement_delivery_days weekday = "mon"). */
const MONDAY = "2026-06-01";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/**
 * Filtrerende Supabase-fake: eq/in anvendes faktisk på seed-rader, upsert
 * merges på (location_id, service_date) slik prod-conflict-key gjør.
 */
function makeAdmin(tables: Tables) {
  const upserts: Array<{ table: string; rows: Row[]; onConflict?: string }> = [];

  function from(table: string) {
    const filters: Array<(r: Row) => boolean> = [];
    let isDelete = false;

    const apply = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));

    const chain: Record<string, unknown> = {
      select() {
        return chain;
      },
      delete() {
        isDelete = true;
        return chain;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => String(r[col] ?? "") === String(val));
        return chain;
      },
      in(col: string, vals: unknown[]) {
        const set = new Set((vals ?? []).map((v) => String(v)));
        filters.push((r) => set.has(String(r[col] ?? "")));
        return chain;
      },
      upsert(rows: Row[], opts?: { onConflict?: string }) {
        upserts.push({ table, rows, onConflict: opts?.onConflict });
        const existing = tables[table] ?? [];
        for (const row of rows) {
          const match = existing.find(
            (r) => r.location_id === row.location_id && r.service_date === row.service_date,
          );
          if (match) Object.assign(match, row);
          else existing.push({ id: `msd-${existing.length + 1}`, ...row });
        }
        tables[table] = existing;
        return Promise.resolve({ error: null });
      },
      then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const rows = apply();
        if (isDelete) {
          tables[table] = (tables[table] ?? []).filter((r) => !rows.includes(r));
        }
        return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
      },
    };
    return chain;
  }

  return { admin: { from } as unknown as SupabaseClient<any>, upserts, tables };
}

/** To providere med identisk weekday+tier-match — kun provider skal skille. */
function seedTwoProviders(): Tables {
  return {
    agreement_delivery_days: [
      { agreement_id: "agr-a", weekday: "mon", tier: "BASIS" },
      { agreement_id: "agr-b", weekday: "mon", tier: "BASIS" },
    ],
    agreements: [
      { id: "agr-a", company_id: "co-a", status: "ACTIVE", provider_id: PROVIDER_A },
      { id: "agr-b", company_id: "co-b", status: "ACTIVE", provider_id: PROVIDER_B },
    ],
    companies: [
      { id: "co-a", provider_id: PROVIDER_A },
      { id: "co-b", provider_id: PROVIDER_B },
    ],
    company_locations: [
      { id: "loc-a", company_id: "co-a" },
      { id: "loc-b", company_id: "co-b" },
    ],
    menu_service_days: [],
  };
}

describe("syncMenuServiceDaysForPublishedMenuDay — provider-isolasjon", () => {
  beforeEach(() => {
    msdiMock.mockReset();
    msdiMock.mockResolvedValue({ msdiRowsUpserted: 0, msdiLocationsSkippedNoTier: 0 });
  });

  it("provider A sin menuDay synker kun til provider A sine agreements/lokasjoner", async () => {
    const { admin, upserts } = makeAdmin(seedTwoProviders());

    const stats = await syncMenuServiceDaysForPublishedMenuDay(admin, {
      date: MONDAY,
      planTier: "BASIS",
      providerId: PROVIDER_A,
    });

    expect(stats.skipped).toBe(false);
    expect(stats.locationCount).toBe(1);
    expect(upserts).toHaveLength(1);
    const rows = upserts[0].rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].location_id).toBe("loc-a");
    expect(rows[0].provider_id).toBe(PROVIDER_A);
  });

  it("provider B sin menuDay synker kun til provider B — påvirker ikke provider A sine menu_service_days", async () => {
    const tables = seedTwoProviders();
    tables.menu_service_days = [
      { id: "msd-a", location_id: "loc-a", service_date: MONDAY, state: "published", cutoff_at: null, provider_id: PROVIDER_A },
    ];
    const { admin, upserts } = makeAdmin(tables);

    const stats = await syncMenuServiceDaysForPublishedMenuDay(admin, {
      date: MONDAY,
      planTier: "BASIS",
      providerId: PROVIDER_B,
    });

    expect(stats.skipped).toBe(false);
    expect(stats.locationCount).toBe(1);
    expect(upserts[0].rows[0].location_id).toBe("loc-b");
    expect(upserts[0].rows[0].provider_id).toBe(PROVIDER_B);
    // Provider A sin eksisterende rad er urørt
    const aRow = tables.menu_service_days.find((r) => r.location_id === "loc-a");
    expect(aRow?.provider_id).toBe(PROVIDER_A);
  });

  it("fail-closed: manglende provider-scope → skip uten global sync", async () => {
    const { admin, upserts } = makeAdmin(seedTwoProviders());

    const stats = await syncMenuServiceDaysForPublishedMenuDay(admin, {
      date: MONDAY,
      planTier: "BASIS",
      providerId: "",
    });

    expect(stats.skipped).toBe(true);
    expect(stats.reason).toBe("MISSING_PROVIDER_SCOPE");
    expect(upserts).toHaveLength(0);
    expect(msdiMock).not.toHaveBeenCalled();
  });

  it("tier/dag-match alene er ikke nok: provider uten egne agreements får null sync", async () => {
    const { admin, upserts } = makeAdmin(seedTwoProviders());

    const stats = await syncMenuServiceDaysForPublishedMenuDay(admin, {
      date: MONDAY,
      planTier: "BASIS",
      providerId: PROVIDER_C,
    });

    expect(stats.skipped).toBe(false);
    expect(stats.locationCount).toBe(0);
    expect(upserts).toHaveLength(0);
  });

  it("defense-in-depth: agreement/company provider-drift filtreres bort", async () => {
    const tables = seedTwoProviders();
    // Legacy-drift: agreement påstår provider A, men company tilhører provider B
    tables.agreements = [{ id: "agr-a", company_id: "co-b", status: "ACTIVE", provider_id: PROVIDER_A }];
    tables.agreement_delivery_days = [{ agreement_id: "agr-a", weekday: "mon", tier: "BASIS" }];
    const { admin, upserts } = makeAdmin(tables);

    const stats = await syncMenuServiceDaysForPublishedMenuDay(admin, {
      date: MONDAY,
      planTier: "BASIS",
      providerId: PROVIDER_A,
    });

    expect(stats.locationCount).toBe(0);
    expect(upserts).toHaveLength(0);
  });

  it("MSDI-sync mottar samme provider-scope", async () => {
    const { admin } = makeAdmin(seedTwoProviders());

    await syncMenuServiceDaysForPublishedMenuDay(admin, {
      date: MONDAY,
      planTier: "BASIS",
      providerId: PROVIDER_A,
    });

    expect(msdiMock).toHaveBeenCalledTimes(1);
    expect(msdiMock.mock.calls[0][1]).toEqual({
      serviceDate: MONDAY,
      locationIds: ["loc-a"],
      providerId: PROVIDER_A,
    });
  });

  it("eksisterende provider-flow (Melhus-mønster) gir samme resultat som før når provider matcher", async () => {
    const { admin, upserts } = makeAdmin(seedTwoProviders());

    const stats = await syncMenuServiceDaysForPublishedMenuDay(admin, {
      date: MONDAY,
      planTier: "BASIS",
      providerId: PROVIDER_A,
    });

    // Samme semantikk som før patch for matchende provider: location upsertes som published
    expect(stats.inserted).toBe(1);
    expect(stats.updated).toBe(0);
    expect(stats.unchanged).toBe(0);
    expect(upserts[0].onConflict).toBe("location_id,service_date");
    expect(upserts[0].rows[0].state).toBe("published");
  });
});

describe("deleteMenuServiceDaysForMenuDay — provider-isolasjon", () => {
  it("provider A sin unpublish sletter kun provider A sine rader", async () => {
    const tables = seedTwoProviders();
    tables.menu_service_days = [
      { id: "msd-a", location_id: "loc-a", service_date: MONDAY, state: "published", provider_id: PROVIDER_A },
      { id: "msd-b", location_id: "loc-b", service_date: MONDAY, state: "published", provider_id: PROVIDER_B },
    ];
    const { admin } = makeAdmin(tables);

    const { deleted } = await deleteMenuServiceDaysForMenuDay(admin, {
      date: MONDAY,
      planTier: "BASIS",
      providerId: PROVIDER_A,
    });

    expect(deleted).toBe(1);
    expect(tables.menu_service_days).toHaveLength(1);
    expect(tables.menu_service_days[0].location_id).toBe("loc-b");
  });

  it("fail-closed: unpublish uten provider-scope sletter ingenting", async () => {
    const tables = seedTwoProviders();
    tables.menu_service_days = [
      { id: "msd-a", location_id: "loc-a", service_date: MONDAY, state: "published", provider_id: PROVIDER_A },
    ];
    const { admin } = makeAdmin(tables);

    const { deleted } = await deleteMenuServiceDaysForMenuDay(admin, {
      date: MONDAY,
      planTier: "BASIS",
      providerId: "",
    });

    expect(deleted).toBe(0);
    expect(tables.menu_service_days).toHaveLength(1);
  });
});

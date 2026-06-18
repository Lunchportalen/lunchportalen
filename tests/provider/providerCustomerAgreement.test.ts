import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  executeProviderCustomerAgreementUpdate,
  loadProviderCustomerAgreement,
} from "@/lib/server/provider/providerCustomerAgreementService";
import { loadProviderScopedCustomer } from "@/lib/server/provider/providerCustomerRemoval";
import { validateProviderAgreementPatch } from "@/lib/server/provider/providerCustomerAgreementValidation";

const MELHUS_PROVIDER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_PROVIDER_ID = "22222222-2222-2222-2222-222222222222";
const PETTERSEN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AGREEMENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LOCATION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

type State = {
  companies: Record<string, unknown>[];
  providers: Record<string, unknown>[];
  agreements: Record<string, unknown>[];
  locations: Record<string, unknown>[];
  registrations: Record<string, unknown>[];
  agreementDeliveryDays: Record<string, unknown>[];
  orders: Record<string, unknown>[];
};

function mkAdmin(state: State) {
  return {
    from: (table: string) => {
      const b: any = {
        _eq: [] as Array<{ col: string; val: unknown }>,
        _in: null as { col: string; vals: unknown[] } | null,
        _update: null as Record<string, unknown> | null,
        _insert: null as Record<string, unknown> | Record<string, unknown>[] | null,
        _delete: false,
        _order: null as { col: string; asc: boolean } | null,
        _limit: null as number | null,
        select: () => b,
        eq: (col: string, val: unknown) => {
          b._eq.push({ col, val });
          return b;
        },
        in: (col: string, vals: unknown[]) => {
          b._in = { col, vals };
          return b;
        },
        order: (col: string, opts?: { ascending?: boolean }) => {
          b._order = { col, asc: opts?.ascending !== false };
          return b;
        },
        limit: (n: number) => {
          b._limit = n;
          return b;
        },
        update: (payload: Record<string, unknown>) => {
          b._update = payload;
          return b;
        },
        insert: (payload: Record<string, unknown> | Record<string, unknown>[]) => {
          b._insert = payload;
          return b;
        },
        delete: () => {
          b._delete = true;
          return b;
        },
        maybeSingle: async () => {
          if (table === "companies") {
            const idEq = b._eq.find((f: { col: string }) => f.col === "id");
            const row = state.companies.find((c) => c.id === idEq?.val) ?? null;
            return { data: row, error: null };
          }
          if (table === "providers") {
            const idEq = b._eq.find((f: { col: string }) => f.col === "id");
            const row = state.providers.find((p) => p.id === idEq?.val) ?? null;
            return { data: row, error: null };
          }
          if (table === "agreements") {
            const companyEq = b._eq.find((f: { col: string }) => f.col === "company_id");
            const providerEq = b._eq.find((f: { col: string }) => f.col === "provider_id");
            const statusEq = b._eq.find((f: { col: string }) => f.col === "status");
            const idEq = b._eq.find((f: { col: string }) => f.col === "id");
            let rows = [...state.agreements];
            if (companyEq) rows = rows.filter((a) => a.company_id === companyEq.val);
            if (providerEq) rows = rows.filter((a) => a.provider_id === providerEq.val);
            if (statusEq) rows = rows.filter((a) => a.status === statusEq.val);
            if (idEq) rows = rows.filter((a) => a.id === idEq.val);
            return { data: rows[0] ?? null, error: null };
          }
          if (table === "company_locations") {
            const idEq = b._eq.find((f: { col: string }) => f.col === "id");
            const row = state.locations.find((l) => l.id === idEq?.val) ?? null;
            return { data: row, error: null };
          }
          if (table === "company_registrations") {
            const agreementEq = b._eq.find((f: { col: string }) => f.col === "agreement_id");
            const rows = state.registrations.filter((r) => r.agreement_id === agreementEq?.val);
            return { data: rows[0] ?? null, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: (v: { data: unknown; error: null }) => void) => {
          if (table === "companies" && b._update) {
            const idEq = b._eq.find((f: { col: string }) => f.col === "id");
            const row = state.companies.find((c) => c.id === idEq?.val);
            if (row) Object.assign(row, b._update);
          }
          if (table === "agreements" && b._update) {
            const idEq = b._eq.find((f: { col: string }) => f.col === "id");
            const row = state.agreements.find((a) => a.id === idEq?.val);
            if (row) Object.assign(row, b._update);
          }
          if (table === "company_locations" && b._update) {
            const idEq = b._eq.find((f: { col: string }) => f.col === "id");
            const row = state.locations.find((l) => l.id === idEq?.val);
            if (row) Object.assign(row, b._update);
          }
          if (table === "company_registrations" && b._update) {
            const idEq = b._eq.find((f: { col: string }) => f.col === "id");
            const row = state.registrations.find((r) => r.id === idEq?.val);
            if (row) Object.assign(row, b._update);
          }
          if (table === "agreement_delivery_days") {
            if (b._delete) {
              const agreementEq = b._eq.find((f: { col: string }) => f.col === "agreement_id");
              state.agreementDeliveryDays = state.agreementDeliveryDays.filter(
                (r) => r.agreement_id !== agreementEq?.val,
              );
            }
            if (b._insert) {
              const rows = Array.isArray(b._insert) ? b._insert : [b._insert];
              state.agreementDeliveryDays.push(...rows);
            }
            if (!b._delete && !b._insert) {
              let rows = [...state.agreementDeliveryDays];
              const agreementEq = b._eq.find((f: { col: string }) => f.col === "agreement_id");
              if (agreementEq) rows = rows.filter((r) => r.agreement_id === agreementEq.val);
              if (b._in) {
                rows = rows.filter((r) => b._in.vals.includes((r as Record<string, unknown>)[b._in.col]));
              }
              resolve({ data: rows, error: null });
              return;
            }
          }
          if (table === "company_registrations" && !b._update) {
            const agreementEq = b._eq.find((f: { col: string }) => f.col === "agreement_id");
            const rows = state.registrations.filter((r) => r.agreement_id === agreementEq?.val);
            resolve({ data: rows, error: null });
            return;
          }
          resolve({ data: null, error: null });
        },
      };
      return b;
    },
  };
}

vi.mock("@/lib/audit/auditWrite", () => ({
  auditWriteMust: vi.fn(async () => undefined),
}));

vi.mock("@/lib/observability/incident", () => ({
  logIncident: vi.fn(async () => undefined),
}));

function baseState(): State {
  return {
    providers: [{ id: MELHUS_PROVIDER_ID, name: "Melhus Catering AS", org_number: "123456789" }],
    companies: [
      {
        id: PETTERSEN_ID,
        name: "Pettersen&Co",
        orgnr: "987654321",
        provider_id: MELHUS_PROVIDER_ID,
        deleted_at: null,
      },
      {
        id: OTHER_PROVIDER_ID,
        name: "Annen Kunde",
        orgnr: "111111111",
        provider_id: OTHER_PROVIDER_ID,
        deleted_at: null,
      },
    ],
    agreements: [
      {
        id: AGREEMENT_ID,
        company_id: PETTERSEN_ID,
        provider_id: MELHUS_PROVIDER_ID,
        location_id: LOCATION_ID,
        status: "ACTIVE",
        tier: "BASIS",
        delivery_days: ["mon", "tue", "wed", "thu", "fri"],
        slot_start: "11:00:00",
        slot_end: "13:00:00",
        submitted_by_name: "Thomas",
        submitted_by_email: "thomas@example.com",
        comment_from_company: null,
        updated_at: "2026-06-01T10:00:00Z",
      },
    ],
    locations: [{ id: LOCATION_ID, company_id: PETTERSEN_ID, name: "Hovedlokasjon", address: "Gate 1" }],
    registrations: [{ id: "reg-1", agreement_id: AGREEMENT_ID, contact_phone: "99887766" }],
    agreementDeliveryDays: [
      { agreement_id: AGREEMENT_ID, weekday: "mon", tier: "BASIS" },
      { agreement_id: AGREEMENT_ID, weekday: "tue", tier: "BASIS" },
    ],
    orders: [{ id: "order-1", company_id: PETTERSEN_ID, status: "DELIVERED", date: "2026-06-16" }],
  };
}

describe("provider customer agreement validation", () => {
  it("avviser tomme leveringsdager", () => {
    const res = validateProviderAgreementPatch({ deliveryDays: [] });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("EMPTY_DELIVERY_DAYS");
  });

  it("avviser ukjent plan", () => {
    const res = validateProviderAgreementPatch({ dayMenus: [{ day: "mon", plan: "GULL" }] });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("INVALID_PLAN");
  });

  it("krever meny for aktiv dag", () => {
    const res = validateProviderAgreementPatch({
      deliveryDays: ["mon", "tue"],
      dayMenus: [{ day: "mon", plan: "BASIS" }],
    });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("MISSING_DAY_MENU");
  });

  it("avviser meny for inaktiv dag", () => {
    const res = validateProviderAgreementPatch({
      deliveryDays: ["mon"],
      dayMenus: [
        { day: "mon", plan: "BASIS" },
        { day: "tue", plan: "LUXUS" },
      ],
    });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("INACTIVE_DAY_MENU");
  });

  it("avviser ugyldig leveringsvindu", () => {
    const res = validateProviderAgreementPatch({ deliveryWindow: { from: "13:00", to: "11:00" } });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("INVALID_DELIVERY_WINDOW");
  });
});

describe("provider customer agreement service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provider_admin kan laste avtale med per-dag meny", async () => {
    const admin = mkAdmin(baseState());
    const res = await loadProviderCustomerAgreement(admin as any, MELHUS_PROVIDER_ID, PETTERSEN_ID);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.agreementId).toBe(AGREEMENT_ID);
      expect(res.data.defaultPlan).toBe("BASIS");
      expect(res.data.dayMenus).toEqual(
        expect.arrayContaining([
          { day: "mon", plan: "BASIS" },
          { day: "tue", plan: "BASIS" },
        ]),
      );
    }
  });

  it("provider_admin kan oppdatere per-dag meny", async () => {
    const state = baseState();
    const admin = mkAdmin(state);
    const res = await executeProviderCustomerAgreementUpdate(
      admin as any,
      { rid: "rid_test", userId: "user-1", email: "admin@melhus.no" },
      {
        providerId: MELHUS_PROVIDER_ID,
        companyId: PETTERSEN_ID,
        patch: {
          deliveryDays: ["mon", "tue", "wed", "thu", "fri"],
          dayMenus: [
            { day: "mon", plan: "BASIS" },
            { day: "tue", plan: "LUXUS" },
            { day: "wed", plan: "ENTERPRISE" },
            { day: "thu", plan: "LUXUS" },
            { day: "fri", plan: "ENTERPRISE" },
          ],
        },
      },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.dayMenus).toEqual([
        { day: "mon", plan: "BASIS" },
        { day: "tue", plan: "LUXUS" },
        { day: "wed", plan: "ENTERPRISE" },
        { day: "thu", plan: "LUXUS" },
        { day: "fri", plan: "ENTERPRISE" },
      ]);
    }
    expect(state.agreementDeliveryDays).toHaveLength(5);
    expect(state.agreements[0].tier).toBe("BASIS");
  });

  it("blokkerer oppdatering for annen provider", async () => {
    const admin = mkAdmin(baseState());
    const res = await executeProviderCustomerAgreementUpdate(
      admin as any,
      { rid: "rid_test", userId: "user-1", email: "admin@melhus.no" },
      {
        providerId: MELHUS_PROVIDER_ID,
        companyId: OTHER_PROVIDER_ID,
        patch: { dayMenus: [{ day: "mon", plan: "LUXUS" }], deliveryDays: ["mon"] },
      },
    );
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("OUT_OF_SCOPE");
  });

  it("telefon uten registrering gir warning, ikke total feil", async () => {
    const state = baseState();
    state.registrations = [];
    const admin = mkAdmin(state);
    const res = await executeProviderCustomerAgreementUpdate(
      admin as any,
      { rid: "rid_test", userId: "user-1", email: "admin@melhus.no" },
      {
        providerId: MELHUS_PROVIDER_ID,
        companyId: PETTERSEN_ID,
        patch: {
          deliveryDays: ["mon"],
          dayMenus: [{ day: "mon", plan: "BASIS" }],
          contact: { phone: "99887766" },
        },
      },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.warnings?.length).toBeGreaterThan(0);
    }
  });

  it("endring rører ikke eksisterende ordre", async () => {
    const state = baseState();
    const admin = mkAdmin(state);
    const before = JSON.stringify(state.orders);
    await executeProviderCustomerAgreementUpdate(
      admin as any,
      { rid: "rid_test", userId: "user-1", email: "admin@melhus.no" },
      {
        providerId: MELHUS_PROVIDER_ID,
        companyId: PETTERSEN_ID,
        patch: {
          deliveryDays: ["mon", "fri"],
          dayMenus: [
            { day: "mon", plan: "BASIS" },
            { day: "fri", plan: "ENTERPRISE" },
          ],
        },
      },
    );
    expect(JSON.stringify(state.orders)).toBe(before);
  });
});

describe("provider customer agreement scope", () => {
  it("blokkerer self-customer", async () => {
    const admin = mkAdmin({
      ...baseState(),
      companies: [
        {
          id: MELHUS_PROVIDER_ID,
          name: "Melhus Catering AS",
          orgnr: "123456789",
          provider_id: MELHUS_PROVIDER_ID,
          deleted_at: null,
        },
      ],
    });
    const res = await loadProviderScopedCustomer(admin as any, MELHUS_PROVIDER_ID, MELHUS_PROVIDER_ID);
    expect("code" in res && res.code).toBe("SELF_CUSTOMER");
  });
});

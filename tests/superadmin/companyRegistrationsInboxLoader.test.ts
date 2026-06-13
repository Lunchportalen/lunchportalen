// @ts-nocheck
// Bevis: superadmin-innboksen dropper ikke lenger PENDING-rader med company_id NULL
// (provider-intake/waitlist), og krasjer ikke når company-relasjonen mangler.
import { describe, test, expect, vi, beforeEach } from "vitest";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PROVIDER_ID = "22222222-2222-4222-8222-222222222222";

const dbState: {
  registrations: Record<string, unknown>[];
  providers: Record<string, unknown>[];
  agreements: Record<string, unknown>[];
  probes: { providersQueried: boolean; providerIdsRequested: string[] };
} = {
  registrations: [],
  providers: [],
  agreements: [],
  probes: { providersQueried: false, providerIdsRequested: [] },
};

function mkBuilder(result: () => { data: unknown; error: null }) {
  const b: any = {
    select: () => b,
    eq: () => b,
    in: () => b,
    order: () => b,
    limit: () => b,
    maybeSingle: async () => result(),
    then: (resolve: any) => resolve(result()),
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "company_registrations") {
        return mkBuilder(() => ({ data: dbState.registrations, error: null }));
      }
      if (table === "providers") {
        dbState.probes.providersQueried = true;
        const b: any = {
          select: () => b,
          in: (_col: string, ids: string[]) => {
            dbState.probes.providerIdsRequested = ids;
            return b;
          },
          then: (resolve: any) => resolve({ data: dbState.providers, error: null }),
        };
        return b;
      }
      if (table === "agreements") {
        return mkBuilder(() => ({ data: dbState.agreements, error: null }));
      }
      return mkBuilder(() => ({ data: [], error: null }));
    },
  }),
}));

const COMPANY_BACKED_ROW = {
  id: "reg-company",
  agreement_id: null,
  status: "PENDING",
  company_id: COMPANY_ID,
  provider_id: PROVIDER_ID,
  company_name: "Reg-navn AS",
  orgnr: "123456789",
  submitted_payload: {},
  employee_count: 28,
  contact_name: "Ola",
  contact_email: "ola@firma.no",
  contact_phone: "99887766",
  address_line: "Gate 1",
  postal_code: "7200",
  city: "Kyrksæterøra",
  created_at: "2026-06-01T10:00:00Z",
  updated_at: null,
  companies: { id: COMPANY_ID, name: "Firma AS", orgnr: "123456789", status: "PENDING" },
};

const INTAKE_ROW = {
  id: "reg-intake",
  agreement_id: null,
  status: "PENDING",
  company_id: null,
  provider_id: PROVIDER_ID,
  company_name: "Intake AS",
  orgnr: "999888777",
  submitted_payload: { source: "provider_registration_intake" },
  employee_count: 30,
  contact_name: "Kari",
  contact_email: "kari@intake.no",
  contact_phone: "98765432",
  address_line: "Intakegate 2",
  postal_code: "7000",
  city: "Trondheim",
  created_at: "2026-06-10T10:00:00Z",
  updated_at: null,
  companies: null,
};

const WAITLIST_ROW = {
  id: "reg-waitlist",
  agreement_id: null,
  status: "PENDING",
  company_id: null,
  provider_id: null,
  company_name: "Waitlist AS",
  orgnr: "111222333",
  submitted_payload: { source: "provider_registration_intake", expand_my_area: true },
  employee_count: 25,
  contact_name: "Per",
  contact_email: "per@venter.no",
  contact_phone: "91234567",
  address_line: "Ventevei 1",
  postal_code: "9999",
  city: "Utenfor",
  created_at: "2026-06-11T10:00:00Z",
  updated_at: null,
  companies: null,
};

describe("loadCompanyRegistrationsInbox — company_id NULL synlighet", () => {
  beforeEach(() => {
    vi.resetModules();
    dbState.registrations = [COMPANY_BACKED_ROW, INTAKE_ROW, WAITLIST_ROW];
    dbState.providers = [{ id: PROVIDER_ID, name: "Melhus Catering" }];
    dbState.agreements = [];
    dbState.probes = { providersQueried: false, providerIdsRequested: [] };
  });

  test("alle tre radtyper er synlige: company-backed, provider-intake og waitlist", async () => {
    const mod = await import("@/lib/server/superadmin/loadCompanyRegistrationsInbox");
    const res = await mod.loadCompanyRegistrationsInbox();
    expect(res.ok).toBe(true);
    if (res.ok !== true) return;

    const ids = res.items.map((i) => i.registration_id).sort();
    expect(ids).toEqual(["reg-company", "reg-intake", "reg-waitlist"]);
  });

  test("companyless rader får trygg presentasjon uten agreement-actions", async () => {
    const mod = await import("@/lib/server/superadmin/loadCompanyRegistrationsInbox");
    const res = await mod.loadCompanyRegistrationsInbox();
    expect(res.ok).toBe(true);
    if (res.ok !== true) return;

    const intake = res.items.find((i) => i.registration_id === "reg-intake")!;
    expect(intake.company_id).toBeNull();
    expect(intake.pipeline_stage_label).toBe("Ikke materialisert");
    expect(intake.pipeline_next_href).toBeNull();
    expect(intake.agreement_id).toBeNull();
    expect(intake.ledger_pending_agreement_id).toBeNull();
    expect(intake.provider_name).toBe("Melhus Catering");

    const waitlist = res.items.find((i) => i.registration_id === "reg-waitlist")!;
    expect(waitlist.company_id).toBeNull();
    expect(waitlist.provider_id).toBeNull();
    expect(waitlist.provider_name).toBeNull();
    expect(waitlist.pipeline_stage_label).toBe("Ikke materialisert");
  });

  test("company-backed rad beholder eksisterende pipeline-semantikk", async () => {
    const mod = await import("@/lib/server/superadmin/loadCompanyRegistrationsInbox");
    const res = await mod.loadCompanyRegistrationsInbox();
    expect(res.ok).toBe(true);
    if (res.ok !== true) return;

    const row = res.items.find((i) => i.registration_id === "reg-company")!;
    expect(row.company_id).toBe(COMPANY_ID);
    expect(row.company_name).toBe("Firma AS");
    expect(row.company_status).toBe("PENDING");
    expect(row.pipeline_stage_label).toContain("Registrert");
    expect(row.pipeline_primary_href).toBe(`/superadmin/registrations/${COMPANY_ID}`);
  });

  test("providernavn slås opp kun for faktiske provider_id-er (ingen NULL i oppslag)", async () => {
    const mod = await import("@/lib/server/superadmin/loadCompanyRegistrationsInbox");
    await mod.loadCompanyRegistrationsInbox();
    expect(dbState.probes.providersQueried).toBe(true);
    expect(dbState.probes.providerIdsRequested).toEqual([PROVIDER_ID]);
  });

  test("krasjer ikke når company-relasjonen er null (ingen rader droppes stille)", async () => {
    dbState.registrations = [WAITLIST_ROW];
    dbState.providers = [];
    const mod = await import("@/lib/server/superadmin/loadCompanyRegistrationsInbox");
    const res = await mod.loadCompanyRegistrationsInbox();
    expect(res.ok).toBe(true);
    if (res.ok !== true) return;
    expect(res.items).toHaveLength(1);
    expect(res.items[0]!.company_name).toBe("Waitlist AS");
  });
});

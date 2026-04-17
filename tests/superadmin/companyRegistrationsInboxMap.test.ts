import { describe, expect, it } from "vitest";
import {
  deriveSuperadminAgreementListRowPresentation,
  deriveSuperadminRegistrationPipelineNext,
  deriveSuperadminRegistrationPipelinePrimaryHref,
  indexLedgerAgreementsByCompanyId,
  mapCompanyRegistrationInboxRow,
  mapCompanyRegistrationDetailRow,
  registrationInboxActionPriority,
} from "@/lib/server/superadmin/loadCompanyRegistrationsInbox";

describe("mapCompanyRegistrationInboxRow", () => {
  it("mapper nested companies-objekt", () => {
    const m = mapCompanyRegistrationInboxRow({
      company_id: "c1",
      employee_count: 42,
      contact_name: "Ola Nordmann",
      contact_email: "ola@example.com",
      contact_phone: "99887766",
      address_line: "Gate 1",
      postal_code: "0123",
      city: "Oslo",
      created_at: "2026-01-02T10:00:00Z",
      updated_at: "2026-01-02T11:00:00Z",
      companies: { id: "c1", name: "Test AS", orgnr: "123456789", status: "PENDING" },
    });
    expect(m?.company_name).toBe("Test AS");
    expect(m?.company_status).toBe("PENDING");
    expect(m?.employee_count).toBe(42);
  });

  it("returnerer null uten company_id", () => {
    expect(mapCompanyRegistrationInboxRow({ company_id: "" })).toBeNull();
  });

  it("mapCompanyRegistrationDetailRow legger på firmatidsstempler", () => {
    const d = mapCompanyRegistrationDetailRow({
      company_id: "c1",
      employee_count: 20,
      contact_name: "Kari",
      contact_email: "k@example.com",
      contact_phone: "11223344",
      address_line: "Vei 2",
      postal_code: "5000",
      city: "Bergen",
      created_at: "2026-03-01T08:00:00Z",
      updated_at: "2026-03-02T09:00:00Z",
      weekday_meal_tiers: { mon: "BASIS", tue: "LUXUS", wed: "BASIS", thu: "BASIS", fri: "LUXUS" },
      delivery_window_from: "11:00",
      delivery_window_to: "13:00",
      terms_binding_months: 12,
      terms_notice_months: 3,
      companies: {
        id: "c1",
        name: "AS Test",
        orgnr: "987654321",
        status: "ACTIVE",
        created_at: "2026-02-01T00:00:00Z",
        updated_at: "2026-03-03T00:00:00Z",
      },
    });
    expect(d?.company_created_at).toBe("2026-02-01T00:00:00Z");
    expect(d?.company_updated_at).toBe("2026-03-03T00:00:00Z");
    expect(d?.weekday_meal_tiers?.tue).toBe("LUXUS");
    expect(d?.delivery_window_from).toBe("11:00");
    expect(d?.terms_binding_months).toBe(12);
    expect(d?.ledger_pending_agreement_id).toBeNull();
    expect(d?.ledger_active_agreement_id).toBeNull();
  });
});

describe("deriveSuperadminRegistrationPipelineNext", () => {
  it("stengt firma: ingen neste href", () => {
    const r = deriveSuperadminRegistrationPipelineNext({
      company_status: "CLOSED",
      ledger_pending_agreement_id: "p1",
      ledger_active_agreement_id: "a1",
    });
    expect(r.next_href).toBeNull();
    expect(r.stage_label).toContain("stengt");
  });

  it("pending: lenke til avtale og godkjenn som neste", () => {
    const r = deriveSuperadminRegistrationPipelineNext({
      company_status: "PENDING",
      ledger_pending_agreement_id: "00000000-0000-4000-8000-000000000001",
      ledger_active_agreement_id: null,
    });
    expect(r.next_href).toBe("/superadmin/agreements/00000000-0000-4000-8000-000000000001");
    expect(r.next_label).toContain("Godkjenn");
  });

  it("mangler utkast: neste er opprett utkast uten href (UI har knapp)", () => {
    const r = deriveSuperadminRegistrationPipelineNext({
      company_status: "PENDING",
      ledger_pending_agreement_id: null,
      ledger_active_agreement_id: null,
    });
    expect(r.next_href).toBeNull();
    expect(r.next_label).toContain("Opprett");
  });
});

describe("deriveSuperadminAgreementListRowPresentation", () => {
  it("ledger-PENDING: neste er godkjenn", () => {
    const p = deriveSuperadminAgreementListRowPresentation({
      agreement_id: "p1",
      agreement_status: "PENDING",
      company_status: "PENDING",
      ledger_pending_agreement_id: "p1",
      ledger_active_agreement_id: null,
    });
    expect(p.next_href).toBe("/superadmin/agreements/p1");
    expect(p.next_label).toContain("Godkjenn");
  });

  it("eldre PENDING som ikke er ledger: åpne detalj", () => {
    const p = deriveSuperadminAgreementListRowPresentation({
      agreement_id: "old",
      agreement_status: "PENDING",
      company_status: "ACTIVE",
      ledger_pending_agreement_id: "new",
      ledger_active_agreement_id: null,
    });
    expect(p.next_label).toContain("detalj");
    expect(p.pipeline_stage_label).toContain("eldre");
  });

  it("ledger-ACTIVE: neste steg nevner pause, ikke implisitt resume", () => {
    const p = deriveSuperadminAgreementListRowPresentation({
      agreement_id: "a1",
      agreement_status: "ACTIVE",
      company_status: "ACTIVE",
      ledger_pending_agreement_id: null,
      ledger_active_agreement_id: "a1",
    });
    expect(p.next_href).toBe("/superadmin/agreements/a1");
    expect(p.next_label.toLowerCase()).toContain("pause");
    expect(p.next_label.toLowerCase()).toMatch(/ingen resume|resume-rpc/i);
  });

  it("ledger-PAUSED: tydeliggjør manglende gjenopptak", () => {
    const p = deriveSuperadminAgreementListRowPresentation({
      agreement_id: "paused-1",
      agreement_status: "PAUSED",
      company_status: "ACTIVE",
      ledger_pending_agreement_id: null,
      ledger_active_agreement_id: null,
    });
    expect(p.next_href).toBe("/superadmin/agreements/paused-1");
    expect(p.next_label).toMatch(/gjenopptak/i);
    expect(p.pipeline_stage_label).toContain("Ledger");
  });
});

describe("deriveSuperadminRegistrationPipelinePrimaryHref", () => {
  it("sender til registreringsdetalj når kun utkast mangler og reg. finnes", () => {
    const href = deriveSuperadminRegistrationPipelinePrimaryHref({
      company_id: "00000000-0000-4000-8000-000000000099",
      company_status: "PENDING",
      ledger_pending_agreement_id: null,
      ledger_active_agreement_id: null,
      registration_exists: true,
    });
    expect(href).toBe("/superadmin/registrations/00000000-0000-4000-8000-000000000099");
  });

  it("bruker avtalelenke når PENDING finnes", () => {
    const href = deriveSuperadminRegistrationPipelinePrimaryHref({
      company_id: "00000000-0000-4000-8000-000000000099",
      company_status: "PENDING",
      ledger_pending_agreement_id: "00000000-0000-4000-8000-000000000001",
      ledger_active_agreement_id: null,
      registration_exists: true,
    });
    expect(href).toContain("/superadmin/agreements/");
  });
});

describe("registrationInboxActionPriority", () => {
  it("PENDING utkast rangeres før manglende utkast", () => {
    const pPend = registrationInboxActionPriority({
      company_status: "PENDING",
      ledger_pending_agreement_id: "x",
      ledger_active_agreement_id: null,
    });
    const pNeed = registrationInboxActionPriority({
      company_status: "PENDING",
      ledger_pending_agreement_id: null,
      ledger_active_agreement_id: null,
    });
    expect(pPend).toBeLessThan(pNeed);
  });
});

describe("indexLedgerAgreementsByCompanyId", () => {
  it("velger nyeste PENDING per firma og én ACTIVE", () => {
    const { pendingIdByCompany, activeIdByCompany } = indexLedgerAgreementsByCompanyId([
      {
        id: "p-old",
        company_id: "c1",
        status: "PENDING",
        created_at: "2026-01-01T10:00:00Z",
      },
      {
        id: "p-new",
        company_id: "c1",
        status: "PENDING",
        created_at: "2026-02-01T10:00:00Z",
      },
      { id: "a1", company_id: "c1", status: "ACTIVE", created_at: "2026-01-15T10:00:00Z" },
    ]);
    expect(pendingIdByCompany.get("c1")).toBe("p-new");
    expect(activeIdByCompany.get("c1")).toBe("a1");
  });
});

import { describe, expect, it } from "vitest";

import {
  PROVIDER_AGREEMENTS_KPI_COPY,
  activeProviderCompanyIds,
} from "@/lib/providers/providerDashboardKpis";

// Loaderen (loadActiveCustomerAgreementsCount) teller agreements kun for ids fra
// activeProviderCompanyIds + provider_id + status=ACTIVE, og returnerer 0 ved tom
// liste/feil. DB-delen er verifisert read-only mot prod (audit 2026-06-12);
// lifecycle-ekskluderingen testes her som ren helper.

describe("activeProviderCompanyIds — company lifecycle ekskludering", () => {
  it("inkluderer aktive companies", () => {
    const ids = activeProviderCompanyIds([
      { id: "a", deleted_at: null, suspended_at: null, paused_at: null },
      { id: "b" },
    ]);
    expect(ids).toEqual(["a", "b"]);
  });

  it("ekskluderer soft-slettede companies", () => {
    const ids = activeProviderCompanyIds([
      { id: "deleted", deleted_at: "2026-06-10T13:49:27Z", suspended_at: null, paused_at: null },
      { id: "active", deleted_at: null, suspended_at: null, paused_at: null },
    ]);
    expect(ids).toEqual(["active"]);
  });

  it("ekskluderer suspenderte companies", () => {
    const ids = activeProviderCompanyIds([
      { id: "suspended", deleted_at: null, suspended_at: "2026-06-01T00:00:00Z", paused_at: null },
    ]);
    expect(ids).toEqual([]);
  });

  it("ekskluderer pausede companies", () => {
    const ids = activeProviderCompanyIds([
      { id: "paused", deleted_at: null, suspended_at: null, paused_at: "2026-06-01T00:00:00Z" },
    ]);
    expect(ids).toEqual([]);
  });

  it("audit-scenario: 1 aktiv + 4 slettede companies gir kun 1 id", () => {
    const ids = activeProviderCompanyIds([
      { id: "melhus", deleted_at: null, suspended_at: null, paused_at: null },
      { id: "fx-active", deleted_at: "2026-06-10T13:49:27Z" },
      { id: "fx-paused", deleted_at: "2026-06-10T13:49:57Z" },
      { id: "fx-other", deleted_at: "2026-06-10T13:49:46Z" },
      { id: "qa", deleted_at: "2026-06-10T13:50:43Z" },
    ]);
    expect(ids).toEqual(["melhus"]);
  });

  it("håndterer tomme/ugyldige rader trygt", () => {
    expect(activeProviderCompanyIds([])).toEqual([]);
    expect(activeProviderCompanyIds([{ id: "" }, { id: null }, { id: "  " }])).toEqual([]);
    expect(activeProviderCompanyIds(undefined as unknown as [])).toEqual([]);
  });
});

describe("PROVIDER_AGREEMENTS_KPI_COPY — label og drilldown", () => {
  it("label er «Aktive kundeavtaler», ikke uklar «Aktive avtaler»", () => {
    expect(PROVIDER_AGREEMENTS_KPI_COPY.label).toBe("Aktive kundeavtaler");
  });

  it("hjelpetekst knytter avtaler til aktive bedrifter", () => {
    expect(PROVIDER_AGREEMENTS_KPI_COPY.foot).toBe("Kundeavtaler knyttet til aktive bedrifter");
  });

  it("drilldown peker til /leverandor/kunder med tilgjengelig title", () => {
    expect(PROVIDER_AGREEMENTS_KPI_COPY.href).toBe("/leverandor/kunder");
    expect(PROVIDER_AGREEMENTS_KPI_COPY.linkTitle).toBe("Se aktive bedriftskunder og avtaler");
  });
});

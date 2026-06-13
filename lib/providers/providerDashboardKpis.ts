// lib/providers/providerDashboardKpis.ts
// Klient-trygg copy + ren KPI-logikk for provider-dashboardet (/leverandor).
//
// Bakgrunn (audit 2026-06-12): «Aktive avtaler» telte rå agreements.status=ACTIVE
// uten å sjekke company-lifecycle. Avtaler på soft-slettede/suspenderte/pausede
// bedrifter ble dermed telt som aktive kundeavtaler.
//
// Staff-level sannhet: aktive kundeavtaler = aktive agreements for bedrifter som
// fortsatt er aktive i samme forstand som «Aktive kunder»-KPI-en.

export const PROVIDER_AGREEMENTS_KPI_COPY = {
  label: "Aktive kundeavtaler",
  foot: "Kundeavtaler knyttet til aktive bedrifter",
  href: "/leverandor/kunder",
  linkTitle: "Se aktive bedriftskunder og avtaler",
} as const;

export type CompanyLifecycleRow = {
  id: unknown;
  deleted_at?: unknown;
  suspended_at?: unknown;
  paused_at?: unknown;
};

/**
 * Company-ids som er aktive i samme forstand som «Aktive kunder»-tellingen:
 * verken slettet, suspendert eller pauset. Brukes til å scope agreement-KPI-en.
 */
export function activeProviderCompanyIds(rows: ReadonlyArray<CompanyLifecycleRow>): string[] {
  const list = Array.isArray(rows) ? rows : [];
  const ids: string[] = [];
  for (const row of list) {
    if (row == null) continue;
    if (row.deleted_at != null) continue;
    if (row.suspended_at != null) continue;
    if (row.paused_at != null) continue;
    const id = String(row.id ?? "").trim();
    if (id) ids.push(id);
  }
  return ids;
}

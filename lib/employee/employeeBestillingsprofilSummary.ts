/**
 * Ren oppsummering av egne ordrehistorikk-rader — ingen ny ordresemantikk.
 * Per leveringsdato velges rad med seneste `sort_at` som «siste kjente» for den datoen.
 */
import type { EmployeeOwnLunchHistoryItem } from "@/lib/employee/employeeOwnLunchHistoryTypes";

function normStatus(s: string): "ACTIVE" | "CANCELLED" | "OTHER" {
  const u = String(s ?? "").trim().toUpperCase();
  if (u === "ACTIVE") return "ACTIVE";
  if (u === "CANCELLED" || u === "CANCELED") return "CANCELLED";
  return "OTHER";
}

export type EmployeeBestillingsprofilPastSummary = {
  /** Unike tidligere leveringsdatoer med minst én ordrelinje */
  antallTidligereDagerMedOrdrelinje: number;
  /** Unike datoer der siste kjente rad er ACTIVE */
  antallRegistrerteDager: number;
  /** Unike datoer der siste kjente rad er kansellert */
  antallKansellerteDager: number;
  /** Unike datoer med annen status enn aktiv/kansellert */
  antallAndreStatusDager: number;
  sisteRegistrerteLeveringsdato: string | null;
  sisteKansellerteLeveringsdato: string | null;
};

export function summarizePastOrderItemsForProfil(items: EmployeeOwnLunchHistoryItem[]): EmployeeBestillingsprofilPastSummary {
  const byDate = new Map<string, EmployeeOwnLunchHistoryItem[]>();
  for (const it of items) {
    const d = String(it.delivery_date_iso ?? "").trim();
    if (!d) continue;
    const list = byDate.get(d) ?? [];
    list.push(it);
    byDate.set(d, list);
  }

  const finalByDate = new Map<string, EmployeeOwnLunchHistoryItem>();
  for (const [d, list] of byDate) {
    const best = list.reduce((a, b) => (a.sort_at >= b.sort_at ? a : b));
    finalByDate.set(d, best);
  }

  let reg = 0;
  let canc = 0;
  let other = 0;
  let lastReg: string | null = null;
  let lastCanc: string | null = null;

  for (const [d, it] of finalByDate) {
    const st = normStatus(it.status_upper);
    if (st === "ACTIVE") {
      reg++;
      if (!lastReg || d > lastReg) lastReg = d;
    } else if (st === "CANCELLED") {
      canc++;
      if (!lastCanc || d > lastCanc) lastCanc = d;
    } else {
      other++;
    }
  }

  return {
    antallTidligereDagerMedOrdrelinje: finalByDate.size,
    antallRegistrerteDager: reg,
    antallKansellerteDager: canc,
    antallAndreStatusDager: other,
    sisteRegistrerteLeveringsdato: lastReg,
    sisteKansellerteLeveringsdato: lastCanc,
  };
}

/** Felt fra `GET /api/order/window` dagmodell — samme som «Min dag». */
export type VindusdagProfilLite = {
  wantsLunch?: unknown;
  orderStatus?: unknown;
};

/**
 * Synlige vindusdager der det ikke finnes aktiv ordre og vinduet ikke rapporterer kansellert ordre
 * (`wantsLunch` / `orderStatus` — ingen ny semantikk).
 */
export function countVindusdagerUtenAktivEllerKansellertOrdre(days: VindusdagProfilLite[]): number {
  let n = 0;
  for (const d of days) {
    if (Boolean(d.wantsLunch)) continue;
    const os = String(d.orderStatus ?? "").trim().toUpperCase();
    if (os === "ACTIVE" || os === "CANCELLED" || os === "CANCELED") continue;
    n++;
  }
  return n;
}

/** Raden med seneste `sort_at` i listen (typisk «siste endring i ordre»). */
export function sisteOppdaterteOrdreRad(
  items: EmployeeOwnLunchHistoryItem[],
): { delivery_date_iso: string | null; sort_at: string | null } {
  if (items.length === 0) return { delivery_date_iso: null, sort_at: null };
  let best = items[0]!;
  for (const it of items) {
    if (it.sort_at > best.sort_at) best = it;
  }
  return {
    delivery_date_iso: String(best.delivery_date_iso ?? "").trim() || null,
    sort_at: String(best.sort_at ?? "").trim() || null,
  };
}

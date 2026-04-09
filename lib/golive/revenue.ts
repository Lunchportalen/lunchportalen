/**
 * Omsetningssporing — **kun reelle tall** fra avtale/CRM (NOK); ingen fiktive beløp.
 * MRR/ARR er avledet av innrapporterte månedlige satser; konvertering krever eksplisitt grunnlag.
 */

export type RevenueCustomer = {
  id: string;
  /**
   * Månedlig tilbakevendende omsetning (NOK) — primær kilde til MRR.
   * Må være ≥ 0 og fra faktisk avtale/fakturagrunnlag.
   */
  monthlyRecurringNok: number;
  /** Leadkilde (CRM / UTM / manuell). */
  leadSource?: string;
  /** Kampanje- eller sporings-id. */
  campaignId?: string;
};

export type RevenueSnapshot = {
  id: string;
  customerId: string;
  mrrNok: number;
  leadSource: string | null;
  campaignId: string | null;
  recordedAtIso: string;
};

export type RevenueOverview = {
  /** Sum av alle innlagte MRR-poster (NOK). */
  mrrNok: number;
  /** MRR × 12 med mindre annet er avtalt — standard ARR-proxy. */
  arrNok: number;
  /**
   * Vunnet / muligheter — **null** uten `conversionBasis` (ikke gjett).
   * 0–1 når begge tall er satt og muligheter > 0.
   */
  conversionRate: number | null;
  /** MRR per leadkilde (NOK). */
  byLeadSource: Record<string, number>;
  /** MRR per kampanje (NOK). */
  byCampaign: Record<string, number>;
  /** Antall aktive omsetningsposter. */
  recordCount: number;
  explain: string[];
};

export type ConversionBasis = {
  /** Antall muligheter / leads i vurderingsgrunnlaget (må være > 0 for rate). */
  opportunities: number;
  /** Antall vunnet (betalende eller signert — defineres i CRM). */
  won: number;
};

/** Siste kjente MRR per kunde — unngår dobbelttelling ved oppdatering. */
const latestByCustomerId = new Map<string, RevenueSnapshot>();

/** Global konverteringsgrunnlag — sett fra CRM/rapportering (ikke auto-gjett). */
let conversionBasis: ConversionBasis | null = null;

function newSnapId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `rev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp0(n: number): number {
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Registrerer én kundes MRR og kobler til leadkilde/kampanje — bygger grunnlag for oversikt.
 */
export function trackRevenue(customer: RevenueCustomer): RevenueOverview {
  const id = String(customer?.id ?? "").trim();
  if (!id) {
    throw new Error("trackRevenue: customer.id er påkrevd.");
  }
  const mrr = clamp0(Number(customer.monthlyRecurringNok));
  const leadSource = customer.leadSource != null ? String(customer.leadSource).trim() : "";
  const campaignId = customer.campaignId != null ? String(customer.campaignId).trim() : "";

  const prev = latestByCustomerId.get(id);
  const snap: RevenueSnapshot = {
    id: prev?.id ?? newSnapId(),
    customerId: id,
    mrrNok: mrr,
    leadSource: leadSource.length ? leadSource : null,
    campaignId: campaignId.length ? campaignId : null,
    recordedAtIso: new Date().toISOString(),
  };
  latestByCustomerId.set(id, snap);

  return getRevenueOverview();
}

/**
 * Setter konverteringsgrunnlag (vunnet / muligheter) — **må** komme fra reelle pipeline-tall.
 */
export function setConversionBasis(basis: ConversionBasis): void {
  const op = Math.floor(Number(basis.opportunities));
  const won = Math.floor(Number(basis.won));
  if (!Number.isFinite(op) || op < 0 || !Number.isFinite(won) || won < 0) {
    throw new Error("setConversionBasis: ugyldige tall.");
  }
  if (won > op) {
    throw new Error("setConversionBasis: vunnet kan ikke overstige muligheter.");
  }
  conversionBasis = { opportunities: op, won };
}

export function getConversionBasis(): ConversionBasis | null {
  return conversionBasis ? { ...conversionBasis } : null;
}

function aggregate(): Omit<RevenueOverview, "conversionRate" | "explain"> {
  let mrrNok = 0;
  const byLeadSource: Record<string, number> = {};
  const byCampaign: Record<string, number> = {};

  for (const s of latestByCustomerId.values()) {
    mrrNok += s.mrrNok;
    const ls = s.leadSource ?? "ukjent";
    const cp = s.campaignId ?? "ingen kampanje";
    byLeadSource[ls] = (byLeadSource[ls] ?? 0) + s.mrrNok;
    byCampaign[cp] = (byCampaign[cp] ?? 0) + s.mrrNok;
  }

  const arrNok = Math.round(mrrNok * 12);
  return {
    mrrNok: Math.round(mrrNok * 100) / 100,
    arrNok,
    byLeadSource,
    byCampaign,
    recordCount: latestByCustomerId.size,
  };
}

/**
 * Full omsetningsoversikt — **konvertering** krever {@link setConversionBasis} eller blir `null`.
 */
export function getRevenueOverview(): RevenueOverview {
  const base = aggregate();
  let conversionRate: number | null = null;
  const explain: string[] = [
    `MRR: sum av siste innrapporterte månedlige satser per kunde (${base.recordCount} kunder).`,
    `ARR: MRR × 12 = ${base.arrNok.toLocaleString("nb-NO")} NOK (proxy).`,
  ];

  if (conversionBasis && conversionBasis.opportunities > 0) {
    conversionRate = conversionBasis.won / conversionBasis.opportunities;
    explain.push(
      `Konvertering: ${conversionBasis.won} / ${conversionBasis.opportunities} = ${(conversionRate * 100).toFixed(2)} %.`,
    );
  } else {
    explain.push("Konvertering: ikke satt — kall setConversionBasis med reelle pipeline-tall.");
  }

  if (Object.keys(base.byLeadSource).length) {
    explain.push("MRR per leadkilde er summert fra sporingsfelt.");
  }
  if (Object.keys(base.byCampaign).length) {
    explain.push("MRR per kampanje er summert fra sporingsfelt.");
  }

  return {
    ...base,
    conversionRate,
    explain,
  };
}

export function listRevenueSnapshots(): RevenueSnapshot[] {
  return [...latestByCustomerId.values()].map((s) => ({ ...s }));
}

export function clearRevenueTracking(): void {
  latestByCustomerId.clear();
  conversionBasis = null;
}

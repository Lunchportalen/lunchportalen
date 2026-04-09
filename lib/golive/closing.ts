/**
 * Salgsavslutning — rent og tydelig: tilbud, friksjon ut, deretter signering og oppstart.
 * Sporbarhet uten å eksponere sensitive beløp i loggtekster (bruk CRM som sannhet for pris).
 */

/** Milepæler etter «ja» fra kunden. */
export type CloseMilestone = "signed" | "onboarding_started";

export type CloseTrackingRecord = {
  id: string;
  /** Kobling til lead / avtale (CRM-id). */
  leadOrDealId: string;
  /** Kontrakt signert (ISO 8601). */
  signedAtIso?: string;
  /** Onboarding igangsatt (ISO 8601). */
  onboardingStartedAtIso?: string;
};

export type ClosingStep = {
  id: string;
  /** Rekkefølge i salgsløpet (1 = først). */
  order: number;
  nameNb: string;
  /** Hva som må være klart — kort og målbart. */
  requirementNb: string;
  /** Hvordan friksjon fjernes eller verdi gjøres eksplisitt. */
  howNb: string;
};

/**
 * Prinsipp for tilbud — **OUTPUT** steg 1.
 * Konkrete priser settes i avtale/CRM, ikke hardkodet her.
 */
export const OFFER_PRINCIPLES = [
  "Tydelig pris: hva kunden betaler (periode, enhet, evt. minimum) uten skjulte tillegg.",
  "Tydelig verdi: hva de får operasjonelt (lunsj, budsjett, sporbarhet, roller) i én setning.",
  "Én primær anbefaling — ingen «valg-meny» som skaper analyseparalyse i første runde.",
] as const;

/**
 * Fjerning av friksjon — **OUTPUT** steg 2.
 */
export const FRICTION_REMOVAL_PRINCIPLES = [
  "Enkel onboarding: én kontaktperson, sjekkliste, forventet tidsbruk oppgitt.",
  "Ingen unødvendig kompleksitet: start med én lokasjon eller pilot før utrulling.",
  "Teknisk oppsett: tydelig hvem som gjør hva (kunde vs. dere) og når det er «go-live».",
] as const;

/**
 * Avslutningsløp — **OUTPUT** liste (steg 1–3 + spor).
 * Brukes som sjekkliste i CRM, ikke som automatisk juridisk kontrakt.
 */
export const CLOSING_STEPS: readonly ClosingStep[] = [
  {
    id: "offer_clarity",
    order: 1,
    nameNb: "Tilbud med tydelig pris og verdi",
    requirementNb: "Kunden skal kunne sammenligne pris og verdi uten å måtte spørre om det som mangler.",
    howNb: "Bruk OFFER_PRINCIPLES; send skriftlig tilbud med oppsummering og neste steg.",
  },
  {
    id: "remove_friction",
    order: 2,
    nameNb: "Fjern friksjon før signering",
    requirementNb: "Onboarding skal oppleves enkelt; ingen kompleksitet i første møte.",
    howNb: "Følg FRICTION_REMOVAL_PRINCIPLES; avklar pilot vs. full rollout skriftlig.",
  },
  {
    id: "close_sign",
    order: 3,
    nameNb: "Signering",
    requirementNb: "Signert avtale eller bestillingsbekreftelse registrert (juridisk/finans eier sannhet).",
    howNb: "Når signert: registrer tidspunkt i spor (signed).",
  },
  {
    id: "onboarding_kickoff",
    order: 4,
    nameNb: "Onboarding startet",
    requirementNb: "Kunden har fått oppstartsmøte eller tilgang slik at leveransen er i gang.",
    howNb: "Når startet: registrer tidspunkt i spor (onboarding_started).",
  },
];

export function listClosingSteps(): readonly ClosingStep[] {
  return CLOSING_STEPS;
}

const closeById = new Map<string, CloseTrackingRecord>();

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `close-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Oppretter eller oppdaterer sporingspost for et avtale-/lead-løp.
 */
export function upsertCloseTracking(record: CloseTrackingRecord): void {
  closeById.set(record.id, { ...record });
}

export function createCloseTracking(leadOrDealId: string): CloseTrackingRecord {
  const id = newId();
  const r: CloseTrackingRecord = { id, leadOrDealId: String(leadOrDealId ?? "").trim() };
  closeById.set(id, r);
  return { ...r };
}

export function markSigned(recordId: string, signedAtIso?: string): CloseTrackingRecord | null {
  const r = closeById.get(recordId);
  if (!r) return null;
  const next: CloseTrackingRecord = {
    ...r,
    signedAtIso: signedAtIso ?? new Date().toISOString(),
  };
  closeById.set(recordId, next);
  return { ...next };
}

export function markOnboardingStarted(recordId: string, atIso?: string): CloseTrackingRecord | null {
  const r = closeById.get(recordId);
  if (!r) return null;
  const next: CloseTrackingRecord = {
    ...r,
    onboardingStartedAtIso: atIso ?? new Date().toISOString(),
  };
  closeById.set(recordId, next);
  return { ...next };
}

export function getCloseTracking(id: string): CloseTrackingRecord | undefined {
  const r = closeById.get(id);
  return r ? { ...r } : undefined;
}

export function listCloseTrackingForDeal(leadOrDealId: string): CloseTrackingRecord[] {
  const k = String(leadOrDealId ?? "").trim();
  if (!k) return [];
  return [...closeById.values()].filter((t) => t.leadOrDealId === k).map((t) => ({ ...t }));
}

export function clearCloseTracking(): void {
  closeById.clear();
}

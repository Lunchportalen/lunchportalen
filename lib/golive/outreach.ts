/**
 * B2B outreach — **ingen spam**: korte, personlige meldinger med tydelig verdi.
 * Tekst er ment til manuell tilpasning per lead; ingen masseutsendelse eller skjult automatisering.
 */
import type { Lead } from "@/lib/golive/leads";

export const OUTREACH_CHANNELS = ["linkedin", "email", "phone"] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

/** Sporbarhet per forsøk (én kanal om gangen anbefales før oppfølging). */
export type OutreachTouchStatus = "sent" | "opened" | "replied";

export type OutreachTouchRecord = {
  id: string;
  leadId: string;
  channel: OutreachChannel;
  status: OutreachTouchStatus;
  /** Når melding ble sendt (ISO 8601). */
  sentAtIso?: string;
  /** E-post/lenke: når åpnet (hvis målt). */
  openedAtIso?: string;
  /** Når svar mottatt. */
  repliedAtIso?: string;
};

export type OutreachFlow = {
  id: string;
  nameNb: string;
  channel: OutreachChannel;
  /** Hva flyten oppnår — menneskelig, verdifokusert. */
  purposeNb: string;
  /** Forslagsmelding (tilpass alltid med navn og kontekst). */
  exampleMessage: string;
  /** E-post: kort emnelinje. */
  emailSubjectHint?: string;
  /** Telefon: ikke skript som robot — kun stikkord. */
  phoneHintsNb?: string;
};

/**
 * Kanoniserte flyter — **én aktiv samtale per lead per uke** anbefales (ingen spam).
 * OUTPUT: strukturert liste for valg av kanal og vinkel.
 */
export const OUTREACH_FLOWS: readonly OutreachFlow[] = [
  {
    id: "li_soft_open",
    nameNb: "LinkedIn — myk åpning",
    channel: "linkedin",
    purposeNb: "Kort, respektfull kontekst (størrelse/sted) før verdi — ingen salg i første setning.",
    exampleMessage:
      "Hei, ser dere har mange ansatte – jobber dere med lunsjløsning i dag?",
  },
  {
    id: "li_value_hook",
    nameNb: "LinkedIn — verdi før produkt",
    channel: "linkedin",
    purposeNb: "Knytte til budsjett/sporbarhet uten å love noe urealistisk.",
    exampleMessage:
      "Hei, vi hjelper bedrifter med å samle lunsj og budsjett på ett sted uten ekstra kantinedrift. Er det relevant for dere?",
  },
  {
    id: "email_intro",
    nameNb: "E-post — kort intro",
    channel: "email",
    purposeNb: "Én tydelig setning om hvorfor dere skriver + én invitasjon til dialog.",
    emailSubjectHint: "Kort spørsmål om lunsj hos [selskap]",
    exampleMessage:
      "Hei,\n\nJeg tar kontakt fordi [selskap] ser ut til å ha et kontormiljø med flere ansatte. Vi jobber med bedriftslunsj med full sporbarhet — passer det at vi avklarer på 10 minutter?\n\nVennlig hilsen",
  },
  {
    id: "email_followup",
    nameNb: "E-post — oppfølging (kun etter svar/åpning)",
    channel: "email",
    purposeNb: "Oppfølging bare når det er naturlig — aldri samme dag som masseutsendelse.",
    emailSubjectHint: "Oppfølging — lunsj hos [selskap]",
    exampleMessage:
      "Hei igjen,\n\nFølger opp kort: fant dere tid til å se på spørsmålet om lunsjløsning? Si fra om det ikke er aktuelt, så noterer jeg det.\n\nHilsen",
  },
  {
    id: "phone_optional",
    nameNb: "Telefon — valgfritt (stikkord)",
    channel: "phone",
    purposeNb: "Kun når lead har bedt om ring eller kjenner dere — ikke kald ringing i stor skala.",
    phoneHintsNb: "Presenter navn + selskap, spør om 2 min, én konkret verdi (sporbarhet/budsjett), avslutt med e-post hvis travel.",
    exampleMessage:
      "«Hei, det er [navn] fra Lunchportalen. Vi hjelper bedrifter med lunsj uten egen kantine — passer det med to minutter nå, eller skal jeg sende en kort e-post?»",
  },
];

export function listOutreachFlows(): readonly OutreachFlow[] {
  return OUTREACH_FLOWS;
}

const touchById = new Map<string, OutreachTouchRecord>();

function newTouchId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `out-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Registrerer eller oppdaterer status for et utsendelsesforsøk (én rad per touch-id).
 */
export function upsertOutreachTouch(record: OutreachTouchRecord): void {
  touchById.set(record.id, { ...record });
}

export function getOutreachTouch(id: string): OutreachTouchRecord | undefined {
  const r = touchById.get(id);
  return r ? { ...r } : undefined;
}

export function listOutreachTouchesForLead(leadId: string): OutreachTouchRecord[] {
  const k = String(leadId ?? "").trim();
  if (!k) return [];
  return [...touchById.values()].filter((t) => t.leadId === k).map((t) => ({ ...t }));
}

/** Tillatte statusoverganger (stabilt spor). */
export function canAdvanceOutreachStatus(from: OutreachTouchStatus, to: OutreachTouchStatus): boolean {
  if (from === to) return true;
  if (from === "sent" && (to === "opened" || to === "replied")) return true;
  if (from === "opened" && to === "replied") return true;
  if (from === "sent" && to === "replied") return true;
  return false;
}

/**
 * Bygger korte, relevante åpningslinjer fra lead — **alltid** manuell gjennomgang før send.
 */
export function buildOpeningMessages(lead: Lead): {
  linkedin: string;
  emailSubject: string;
  emailBody: string;
  phoneStikkordNb: string;
} {
  const name = String(lead.companyName ?? "").trim() || "deres selskap";
  const loc = String(lead.location ?? "").trim();
  const emp = Number(lead.employees);
  const sizeHint =
    Number.isFinite(emp) && emp >= 20 ? `ser ut til å ha et godt kontormiljø` : "jeg så profilen deres";

  const linkedin = `Hei — ${sizeHint} hos ${name}${loc ? ` (${loc})` : ""}. Jobber dere med lunsjløsning i dag, eller er det noe vi kan avklare kort?`;

  const emailSubject = `Kort spørsmål om lunsj — ${name}`;

  const emailBody = `Hei,\n\nJeg tar kontakt fordi ${name}${loc ? ` (${loc})` : ""} passer godt for bedriftslunsj med sporbarhet og budsjett på ett sted. Er det verdt en kort prat?\n\nVennlig hilsen`;

  const phoneStikkordNb = `Navn + Lunchportalen. Spør om 2 min. Én verdi: samlet lunsj uten kantinedrift. Avslutt med e-post hvis travel.`;

  return { linkedin, emailSubject, emailBody, phoneStikkordNb };
}

/** Nullstill spor (f.eks. tester). */
export function clearOutreachTouches(): void {
  touchById.clear();
}

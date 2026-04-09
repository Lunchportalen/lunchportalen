/**
 * Salgssamtale — tilpasser svar uten å presse blindt: detekterer signal, foreslår pivot, tydelig neste mål.
 * Tekst er forslag; menneske godkjenner alltid før send.
 */

export type ConversationGoal = "meeting" | "demo";

/** Inngående signaler vi kan reagere målrettet på. */
export type InboundSignalKind =
  | "has_canteen"
  | "not_relevant"
  | "positive_interest"
  | "need_more_info"
  | "timing_bad";

export type DetectedInboundSignal = {
  kind: InboundSignalKind;
  /** Første treff (for logg, ikke persondata). */
  matchedHint: string;
};

export type ConversationFlow = {
  id: string;
  nameNb: string;
  /** Tekstfragmenter (normalisert søk) — minst ett treff aktiverer flyten. */
  detectPatterns: string[];
  /** Forslag til pivot — tilpass tone og navn. */
  pivotMessageNb: string;
  /** Neste steg vi sikter mot (uten aggressiv closing). */
  goal: ConversationGoal;
  /** Når pivot er passende — ikke bruk ved avslag. */
  adaptNotesNb: string;
};

/**
 * Kanoniserte samtaleflyter — OUTPUT for valg av respons.
 * Rekkefølge: mer spesifikke mønstre bør sjekkes før generelle (bruk {@link detectInboundSignals}).
 */
export const CONVERSATION_FLOWS: readonly ConversationFlow[] = [
  {
    id: "canteen_pivot",
    nameNb: "Har allerede kantine",
    detectPatterns: [
      "vi har kantine",
      "har kantine",
      "egen kantine",
      "kantine på huset",
      "bedriftskantine",
    ],
    pivotMessageNb:
      "Skjønner – mange bruker oss nettopp for å slippe drift av kantine, med bestilling og budsjett samlet. Gir det mening at vi tar en kort prat om hvordan det kan se ut hos dere?",
    goal: "meeting",
    adaptNotesNb:
      "Anerkjenn først — ikke argumenter bort kantinen; vis verdi (drift, sporbarhet, flere lokasjoner).",
  },
  {
    id: "not_relevant_soft",
    nameNb: "Ikke aktuelt (myk avslutning)",
    detectPatterns: [
      "ikke aktuelt",
      "passer ikke",
      "ingen interesse",
      "ikke interessert",
      "avslå",
    ],
    pivotMessageNb:
      "Takk for tydelig svar — da noterer jeg det. Hvis behovet endrer seg senere (f.eks. flere lokasjoner eller ny kantinestrategi), er det greit om jeg tar kontakt én gang til om et halvt år?",
    goal: "meeting",
    adaptNotesNb:
      "Ikke presse: ett respektfullt spørsmål, deretter stopp. Neste møte/demo bare hvis de svarer positivt senere.",
  },
  {
    id: "positive_book",
    nameNb: "Interesse — mot møte/demo",
    detectPatterns: [
      "interessant",
      "høre mer",
      "fortell mer",
      "gjerne",
      "book",
      "møte",
      "demo",
      "ring meg",
      "send mer info",
    ],
    pivotMessageNb:
      "Supert. Foreslår 20 min: kort gjennomgang av hvordan dere kan samle lunsj og budsjett uten ekstra drift — passer Teams eller telefon neste uke?",
    goal: "meeting",
    adaptNotesNb:
      "Match deres kanal (Teams/telefon); bekreft tid — ikke tre påminnelser samme dag.",
  },
  {
    id: "more_info",
    nameNb: "Trenger mer informasjon",
    detectPatterns: ["mer informasjon", "utdyp", "hvordan fungerer", "hva koster", "pris"],
    pivotMessageNb:
      "Godt spørsmål — jeg sender en kort oversikt og kan gjerne gå gjennom på 15 min slik at det blir konkret for deres lokasjoner. Passer det med en kort demo?",
    goal: "demo",
    adaptNotesNb: "Svar på spørsmålet først (ærlig, målbar), deretter invitasjon til demo — ikke omvendt.",
  },
  {
    id: "timing_later",
    nameNb: "Dårlig tid nå",
    detectPatterns: ["senere", "ikke nå", "travel", "kom tilbake", "neste kvartal", "neste år"],
    pivotMessageNb:
      "Helt i orden. Når passer det bedre å ta en kort avstemning — skal jeg legge inn et forslag i kalenderen eller sende en påminnelse på e-post?",
    goal: "meeting",
    adaptNotesNb: "Ett konkret neste steg; ikke flere prikker samme uke uten svar.",
  },
];

function norm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
}

function mapKindToSignal(flowId: string): InboundSignalKind {
  switch (flowId) {
    case "canteen_pivot":
      return "has_canteen";
    case "not_relevant_soft":
      return "not_relevant";
    case "positive_book":
      return "positive_interest";
    case "more_info":
      return "need_more_info";
    case "timing_later":
      return "timing_bad";
    default:
      throw new Error(`Unknown conversation flow: ${flowId}`);
  }
}

/**
 * Finner første matchende flyt fra fritekstsvar (e-post, LinkedIn, SMS).
 */
export function matchConversationFlow(inboundText: string): ConversationFlow | null {
  const t = norm(inboundText);
  if (t.length < 2) return null;
  for (const flow of CONVERSATION_FLOWS) {
    for (const p of flow.detectPatterns) {
      if (t.includes(norm(p))) return flow;
    }
  }
  return null;
}

/**
 * Detekterer signal + hint — brukes til logging og dynamisk valg av pivot.
 * `null` = ingen kjent mønster (ikke gjett — la menneske svare).
 */
export function detectInboundSignals(inboundText: string): DetectedInboundSignal | null {
  const t = norm(inboundText);
  if (t.length < 2) return null;
  const flow = matchConversationFlow(inboundText);
  if (!flow) return null;
  let matchedHint = flow.detectPatterns[0] ?? "";
  for (const p of flow.detectPatterns) {
    if (t.includes(norm(p))) {
      matchedHint = p;
      break;
    }
  }
  return { kind: mapKindToSignal(flow.id), matchedHint };
}

export function listConversationFlows(): readonly ConversationFlow[] {
  return CONVERSATION_FLOWS;
}

export type SuggestedReply = {
  flowId: string;
  goal: ConversationGoal;
  pivotMessageNb: string;
  adaptNotesNb: string;
};

/**
 * Foreslår pivot og mål ut fra inngående tekst — **null** hvis ukjent (ikke gjett blindt).
 */
export function suggestReplyFromInbound(inboundText: string): SuggestedReply | null {
  const flow = matchConversationFlow(inboundText);
  if (!flow) return null;
  return {
    flowId: flow.id,
    goal: flow.goal,
    pivotMessageNb: flow.pivotMessageNb,
    adaptNotesNb: flow.adaptNotesNb,
  };
}

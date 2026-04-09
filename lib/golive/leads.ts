/**
 * B2B lead-pipeline — **kun reelle selskaper** innlevert manuelt / fra CRM / godkjente kilder.
 * Ingen masseuthenting eller scraping. Prioritet er forklarbar og deterministisk.
 */

export type Lead = {
  id: string;
  companyName: string;
  industry: string;
  employees: number;
  location: string;
  status: "new" | "contacted" | "qualified" | "closed";
};

export type LeadPriorityResult = {
  /** 0–100 */
  score: number;
  explain: string[];
};

/**
 * Målprofil (for prioritering — ikke automatisk sannhet om selskapet).
 * Brukes i {@link scoreLead} og som dokumentasjon.
 */
export const LEAD_TARGET_CRITERIA = [
  "Minimum 20 ansatte (kontorvolum og budsjett til bedriftslunsj).",
  "Kontorbedrift / kunnskapsarbeid (IT, finans, profesjonelle tjenester, media, osv.).",
  "Flere lokasjoner ønskelig (mer komplekst behov = høyere verdi for plattform).",
  "Reell virksomhet med sporbar `companyName` og `location` — ingen oppdiktede poster.",
] as const;

/** Lav relevans for typisk kontor-/bedriftslunsj (substring-match, case-insensitive). */
const LOW_FIT_INDUSTRY_HINTS = [
  "bygg",
  "anlegg",
  "transport",
  "logistikk",
  "landbruk",
  "butikk",
  "detaljhandel",
  "hotell",
  "restaurant",
  "grossist",
] as const;

/** Støtter mål om kontorbedrift (substring-match, case-insensitive). */
const OFFICE_INDUSTRY_HINTS = [
  "it",
  "teknologi",
  "software",
  "konsulent",
  "finans",
  "bank",
  "forsikring",
  "advokat",
  "revisor",
  "byrå",
  "media",
  "telekom",
  "telekommunikasjon",
  "eiendom",
  "forvaltning",
  "hr",
  "personal",
  "kontor",
  "holding",
  "industri",
  "produksjon",
  "engineering",
  "utdanning",
  "offentlig",
  "helse",
  "farmasi",
  "energi",
] as const;

function norm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
}

function hasAnyHint(hay: string, hints: readonly string[]): boolean {
  const h = norm(hay);
  return hints.some((k) => h.includes(k));
}

/** Svak indikasjon på flere lokasjoner uten eget felt (kun heuristikk). */
function multiLocationHint(location: string): boolean {
  const s = String(location ?? "").trim();
  if (s.length < 3) return false;
  if (/[,;/]/.test(s)) return true;
  if (/\bog\b/i.test(s) && s.split(/\s+/).length >= 4) return true;
  if (/\d+\s*(lokasjon|avdeling|kontor|steder)/i.test(s)) return true;
  return false;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Sterk indikasjon på daglig lunsj-/kantinebehov i kontormiljø (kun tekst-match). */
const STRONG_LUNCH_NEED_HINTS = [
  "it",
  "software",
  "konsulent",
  "finans",
  "bank",
  "forsikring",
  "advokat",
  "revisor",
  "byrå",
  "media",
  "telekom",
  "engineering",
  "teknologi",
] as const;

/**
 * Regler for salgskvalifisering (avslag = støy / utenfor ICP).
 * Godkjennelse krever i tillegg høy sannsynlighet for lunsjbehov — se {@link qualifyLead}.
 */
export const QUALIFICATION_RULES = {
  minEmployees: 20,
  rejectBelowEmployees: "Avslå ved færre enn 20 ansatte (ikke realistisk volum for bedriftslunsj).",
  rejectIrrelevantIndustry:
    "Avslå ved tydelig irrelevant bransje (lav kontor-/lunsj-relevans) eller tom bransjetekst.",
  acceptHighLunchNeed:
    "Godkjenn kun ved høy sannsynlighet for lunsjbehov: kontorprofil + tilstrekkelig volum + signal (sterk bransje og/eller flere lokasjoner).",
} as const;

export type QualificationDecision = "accept" | "reject";

export type LeadQualificationResult = {
  decision: QualificationDecision;
  /**
   * 0–100 kvalitet for **godkjente** leads; ved avslag 0 (støy filtrert).
   * Uavhengig av {@link scoreLead} (prioritet i pipeline).
   */
  qualityScore: number;
  reasons: string[];
};

function industryRelevantForOffice(lead: Lead): boolean {
  const ind = String(lead?.industry ?? "").trim();
  if (ind.length < 2) return false;
  const lowFit = hasAnyHint(ind, LOW_FIT_INDUSTRY_HINTS);
  const officeFit = hasAnyHint(ind, OFFICE_INDUSTRY_HINTS);
  if (lowFit && !officeFit) return false;
  return officeFit;
}

/** Høy sannsynlighet for lunsjbehov — realistisk, streng nok til å filtrere støy. */
export function hasHighLunchNeedLikelihood(lead: Lead): boolean {
  const em = Number(lead?.employees);
  const emp = Number.isFinite(em) && em >= 0 ? em : 0;
  if (emp < QUALIFICATION_RULES.minEmployees) return false;
  const ind = String(lead?.industry ?? "");
  if (!hasAnyHint(ind, OFFICE_INDUSTRY_HINTS)) return false;

  const strong = hasAnyHint(ind, STRONG_LUNCH_NEED_HINTS);
  const multi = multiLocationHint(String(lead?.location ?? ""));
  const volume = emp >= 45;
  /** 24+ ansatte i kontorsegment gir ofte stabilt behov (kantine / felles ordning). */
  const midVolume = emp >= 24;

  return strong || multi || volume || midVolume;
}

/**
 * Kvalifiserer ett lead: avslag ved ICP-brudd, ellers kvalitetsscore 0–100.
 */
export function qualifyLead(lead: Lead): LeadQualificationResult {
  const reasons: string[] = [];
  const em = Number(lead?.employees);
  const emp = Number.isFinite(em) && em >= 0 ? em : 0;
  const ind = String(lead?.industry ?? "").trim();

  if (ind.length < 2) {
    reasons.push("Avslag: bransje mangler eller er for kort — kan ikke vurdere relevans (støy).");
    return { decision: "reject", qualityScore: 0, reasons };
  }

  if (emp < QUALIFICATION_RULES.minEmployees) {
    reasons.push(
      `Avslag: ${emp} ansatte — under minimum ${QUALIFICATION_RULES.minEmployees} (realistisk terskel for lunsjbehov).`,
    );
    return { decision: "reject", qualityScore: 0, reasons };
  }

  if (!industryRelevantForOffice(lead)) {
    reasons.push("Avslag: bransje vurderes som ikke relevant for kontor-/bedriftslunsj (ICP).");
    return { decision: "reject", qualityScore: 0, reasons };
  }

  if (!hasHighLunchNeedLikelihood(lead)) {
    reasons.push(
      "Avslag: ikke høy nok sannsynlighet for lunsjbehov (krever sterk kontorprofil og signal: størrelse, flere lokasjoner eller tydelig bransje).",
    );
    return { decision: "reject", qualityScore: 0, reasons };
  }

  let q = 52;
  if (emp >= 55) q += 22;
  else if (emp >= 35) q += 14;
  else q += 6;

  if (hasAnyHint(ind, STRONG_LUNCH_NEED_HINTS)) q += 12;
  if (multiLocationHint(String(lead?.location ?? ""))) q += 10;

  if (lead.status === "qualified") q += 6;
  else if (lead.status === "contacted") q += 3;

  const qualityScore = clamp100(q);
  reasons.push(
    `Godkjent: ≥${QUALIFICATION_RULES.minEmployees} ansatte, relevant bransje, høy forventet lunsjbehov.`,
    `Kvalitetsscore: ${qualityScore}/100.`,
  );

  return { decision: "accept", qualityScore, reasons };
}

export type QualifiedLead = Lead & {
  qualityScore: number;
  qualification: LeadQualificationResult;
};

/**
 * Returnerer kun **godkjente** leads med kvalitetsscore — sortert synkende etter score.
 */
export function listQualifiedLeads(leads: Lead[]): QualifiedLead[] {
  const list = Array.isArray(leads) ? leads : [];
  const out: QualifiedLead[] = [];
  for (const lead of list) {
    const qualification = qualifyLead(lead);
    if (qualification.decision !== "accept") continue;
    out.push({
      ...lead,
      qualityScore: qualification.qualityScore,
      qualification,
    });
  }
  return out.sort((a, b) => b.qualityScore - a.qualityScore);
}

/**
 * Prioritet 0–100: størrelse (20+), kontor-relevans, flere lokasjoner (heuristikk), lett status-justering.
 */
export function scoreLead(lead: Lead): LeadPriorityResult {
  const explain: string[] = [];
  let raw = 0;

  const em = Number(lead?.employees);
  const emp = Number.isFinite(em) && em >= 0 ? em : 0;

  // Størrelse (0–40) — fokus 20+
  if (emp >= 20) {
    raw += 40;
    explain.push(`Ansatte ${emp} → mål oppfylt (≥20) → +40.`);
  } else if (emp >= 15) {
    raw += 28;
    explain.push(`Ansatte ${emp} → nær mål (15–19) → +28.`);
  } else if (emp >= 10) {
    raw += 18;
    explain.push(`Ansatte ${emp} → under mål, men B2B-mulig (10–14) → +18.`);
  } else if (emp > 0) {
    raw += 8;
    explain.push(`Ansatte ${emp} → under typisk mål for volum → +8.`);
  } else {
    explain.push("Ansatte: ukjent eller 0 → +0 (verifiser før outbound).");
  }

  const ind = String(lead?.industry ?? "");
  const lowFit = hasAnyHint(ind, LOW_FIT_INDUSTRY_HINTS);
  const officeFit = hasAnyHint(ind, OFFICE_INDUSTRY_HINTS);

  // Bransje (0–35)
  if (lowFit && !officeFit) {
    explain.push(`Bransje «${ind}» matcher lav-prioritet segment → +5 (begrenset kontor-fit).`);
    raw += 5;
  } else if (officeFit) {
    raw += 35;
    explain.push(`Bransje «${ind}» matcher kontor-/B2B-mål → +35.`);
  } else {
    raw += 15;
    explain.push(`Bransje «${ind}» → nøytral / ukjent mapping → +15 (vurder manuelt).`);
  }

  // Lokasjon / flere steder (0–25)
  const loc = String(lead?.location ?? "");
  if (multiLocationHint(loc)) {
    raw += 25;
    explain.push(`Lokasjon antyder flere steder («${loc.slice(0, 80)}») → +25 (heuristikk).`);
  } else if (loc.trim().length >= 3) {
    raw += 12;
    explain.push(`Én lokasjon oppgitt → +12 (bekreft antall lokasjoner i CRM).`);
  } else {
    explain.push("Lokasjon mangler eller for kort → +0.");
  }

  // Status (± liten justering — pipeline-sanity)
  const st = lead?.status;
  if (st === "qualified") {
    raw += 4;
    explain.push("Status «qualified» → +4 (allerede kvalifisert).");
  } else if (st === "contacted") {
    raw += 2;
    explain.push("Status «contacted» → +2.");
  } else if (st === "closed") {
    raw -= 8;
    explain.push("Status «closed» → −8 (ikke prioritert for ny akvisisjon).");
  } else {
    explain.push('Status «new» → +0 (baseline).');
  }

  const score = clamp100(raw);
  explain.push(`Prioritetsscore: ${score}/100.`);

  return { score, explain };
}

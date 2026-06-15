/** Shared Norwegian copy for company-admin surfaces (UI only). */

export const TECHNICAL_DETAILS_SUMMARY = "Vis teknisk info";

export const SUPPORT_BUTTON_LABEL = "Kontakt Lunchportalen";

export const LOCATIONS_SCOPE_NOTE =
  "Leveringsstedene er knyttet til avtalen. Kontakt Lunchportalen hvis noe skal endres.";

export const AGREEMENT_CHANGE_NOTE =
  "Kontakt Lunchportalen for å endre plan, leveringsdager eller fakturainformasjon.";

export const PEOPLE_ONBOARDING_EMPTY_TITLE = "Ingen ansatte er invitert ennå";

export const PEOPLE_ONBOARDING_EMPTY_BODY = "Start med å invitere én pilotansatt.";

export const PEOPLE_LIST_TITLE = "Ansattliste";

export function peopleListScopeNote(companyName: string) {
  return `Kun ansatte i ${companyName} vises.`;
}

export const PEOPLE_READINESS_NEXT_INVITE = "Neste steg: inviter ansatte";

export const PEOPLE_READINESS_HAS_EMPLOYEES =
  "Ansatte kan bestille når menyen er publisert og cut-off ikke er passert.";

export const PEOPLE_INVITES_ACCORDION_NOTE =
  "Her vises invitasjoner som er sendt, men ikke fullført.";

export const PEOPLE_SUPPORT_ACCORDION_NOTE =
  "Kontakt Lunchportalen hvis en ansatt ikke får invitasjonen.";

export const INSIGHTS_EMPTY_TITLE = "Ingen bestillingsgrunnlag ennå";

export const INSIGHTS_EMPTY_BODY =
  "Når ansatte begynner å bestille, vises kostnad, volum og historikk her.";

export const UKE_BESTILLBARHET_SUBTITLE =
  "Her ser du hvilke dager ansatte kan bestille lunsj, basert på avtalen og cut-off.";

export function bookabilityDayStatus(day: {
  daymap_active: boolean;
  booking: "open" | "blocked";
  detail_lines_nb: string[];
}): string {
  if (!day.daymap_active) return "Stengt";
  if (day.booking === "open") return "Åpen for bestilling";
  const cutoffPassed = day.detail_lines_nb.some((line) =>
    /cut[- ]?off|08:00|kl\.\s*08/i.test(line),
  );
  if (cutoffPassed) return "Cut-off passert";
  return "Stengt";
}

export function locationStatusLabel(status: string): string {
  const upper = String(status || "").toUpperCase();
  if (upper === "ACTIVE") return "Aktiv";
  if (upper === "INACTIVE") return "Deaktivert";
  return upper || "Ukjent";
}

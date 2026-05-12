/**
 * CP5/CP8 — én eksplisitt operativ publish-kjede for uke/meny (dokumentasjon i kode + UI).
 * Ingen ny runtime; publish = Sanity Studio.
 */

export type OperationalWeekMenuPublishStep = {
  step: number;
  title: string;
  detail: string;
  /** Eksisterende flate som forklarer eller utfører neste steg */
  actionHref?: string;
  actionLabel?: string;
  external?: boolean;
};

export const OPERATIONAL_WEEK_MENU_PUBLISH_CHAIN: OperationalWeekMenuPublishStep[] = [
  {
    step: 1,
    title: "Avtale i runtime (DB)",
    detail:
      "company_current_agreement + leveringsdager og måltidstyper styrer hva som kan vises og bestilles — uendret sannhet.",
  },
  {
    step: 2,
    title: "Publisering av menydokumenter (Sanity)",
    detail:
      "Operativ meny kommer fra Sanity menu/menuDay. Redigering og publish skjer i Studio — én kilde, ingen duplikat motor i Postgres.",
    actionLabel: "Åpne Studio (menykilde)",
    actionHref: "__STUDIO__",
    external: true,
  },
  {
    step: 3,
    title: "Runtime-lesing",
    detail: "GET /api/week bygger uken fra avtale + publiserte menyfragmenter — samme data som tabellen under på denne siden.",
  },
  {
    step: 4,
    title: "Ansatt-uke",
    detail: "Portal-ukevisning og bestilling bruker kjeden over.",
    actionLabel: "Kontrollplan-moduler",
    actionHref: "/backoffice/domains",
  },
];

/**
 * CP6 — eksplisitt «live posture» for moduler (ærlig klassifisering).
 * Uavhengig av strip-badges — brukes for orkestrering, dokumentasjon og UI som ikke skal feiltolkes som bred live.
 */

export type ModuleLivePostureKind =
  | "LIVE"
  | "LIMITED"
  | "DRY_RUN"
  | "STUB"
  | "INTERNAL_ONLY"
  | "DISABLE_FOR_BROAD_LIVE";

export type ModuleLivePostureEntry = {
  id: string;
  label: string;
  posture: ModuleLivePostureKind;
  /** Kort forklaring — menneskelesbart */
  note: string;
};

/**
 * Kanonisk register (CP6). Hold synk med faktisk backend-atferd.
 */
export const MODULE_LIVE_POSTURE_REGISTRY: ModuleLivePostureEntry[] = [
  {
    id: "operational_week_menu_governance",
    label: "Operativ uke/meny (CMS-orkestrering)",
    posture: "LIVE",
    note: "Kjede og readiness i backoffice; menypublisering skjer i Sanity Studio — samme kilde som runtime leser.",
  },
  {
    id: "weekplan_editorial",
    label: "Redaksjonell weekPlan",
    posture: "LIMITED",
    note: "Editorial/marketing — ikke GET /api/week for bestilling.",
  },
  {
    id: "company_agreement_location_surfaces",
    label: "Firma / avtale / lokasjon (CMS-flater)",
    posture: "LIVE",
    note: "Read/review + routing til superadmin/admin — ingen shadow-DB.",
  },
  {
    id: "company_admin_tower",
    label: "Company admin",
    posture: "LIVE",
    note: "Operativ runtime for eget selskap.",
  },
  {
    id: "kitchen_tower",
    label: "Kitchen",
    posture: "LIVE",
    note: "Operativ produksjonsvisning.",
  },
  {
    id: "driver_tower",
    label: "Driver",
    posture: "LIVE",
    note: "Operativ leveranseflate.",
  },
  {
    id: "superadmin_tower",
    label: "Superadmin",
    posture: "LIVE",
    note: "Plattformkontroll — høy sensitivitet.",
  },
  {
    id: "social_calendar",
    label: "Social kalender (backoffice)",
    posture: "LIMITED",
    note: "Planlegging/review — ikke garantert ekstern live publish.",
  },
  {
    id: "social_publish",
    label: "Social ekstern publish",
    posture: "DRY_RUN",
    note: "Policy/nøkler — ikke anta produksjonskobling.",
  },
  {
    id: "seo_growth",
    label: "SEO / vekst",
    posture: "LIMITED",
    note: "Review-first; kombinasjon editor/batch.",
  },
  {
    id: "esg",
    label: "ESG",
    posture: "LIMITED",
    note: "Aggregater — review før tolkning.",
  },
  {
    id: "worker_jobs",
    label: "Worker (e-post / AI / eksperiment)",
    posture: "STUB",
    note: "Delvis ikke implementert — ikke produksjonsgarantert.",
  },
  {
    id: "cron_growth_esg",
    label: "Cron — growth / ESG-aggregater",
    posture: "INTERNAL_ONLY",
    note: "Drift/jobb — ikke brukerflate for direkte publish.",
  },
];

export function getModuleLivePostureEntry(id: string): ModuleLivePostureEntry | undefined {
  return MODULE_LIVE_POSTURE_REGISTRY.find((x) => x.id === id);
}

/** Growth-sider: koble UI-modul til register-id */
export function getGrowthModuleLivePosture(moduleId: "seo" | "social" | "esg"): ModuleLivePostureEntry | undefined {
  const map: Record<typeof moduleId, string> = {
    seo: "seo_growth",
    social: "social_publish",
    esg: "esg",
  };
  return getModuleLivePostureEntry(map[moduleId]);
}

export function isNonBroadLivePosture(p: ModuleLivePostureKind): boolean {
  return p === "DRY_RUN" || p === "STUB" || p === "INTERNAL_ONLY" || p === "DISABLE_FOR_BROAD_LIVE" || p === "LIMITED";
}

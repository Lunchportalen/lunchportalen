/**
 * Superadmin kontrollsenter — lenker til faktiske App Router-sider (ingen dynamiske segmenter).
 * Oppdater ved nye superadmin- eller backoffice-ruter.
 */
export type SuperadminCapability = {
  id: string;
  label: string;
  description?: string;
  href: string;
  group: "core" | "operations" | "growth" | "system";
  enabled: boolean;
};

export const capabilities: SuperadminCapability[] = [
  // —— Kjerne (core) ——
  {
    id: "companies",
    label: "Firma",
    description: "Livsløp, arkiv og firmaliste.",
    href: "/superadmin/companies",
    group: "core",
    enabled: true,
  },
  {
    id: "firms",
    label: "Firmadetaljer",
    description: "Administrasjon og ansatte per firma (detaljvisning).",
    href: "/superadmin/firms",
    group: "core",
    enabled: true,
  },
  {
    id: "enterprise",
    label: "Konsern",
    description: "Enterprise-grupper og flerlokasjon.",
    href: "/superadmin/enterprise",
    group: "core",
    enabled: true,
  },
  {
    id: "agreements",
    label: "Avtaler",
    description: "Godkjenning og status for avtaler.",
    href: "/superadmin/agreements",
    group: "core",
    enabled: true,
  },
  {
    id: "users",
    label: "Brukere",
    description: "Bruker- og rolleoversikt.",
    href: "/superadmin/users",
    group: "core",
    enabled: true,
  },
  {
    id: "billing",
    label: "Fakturakontoer",
    description: "Fakturering og kontoer.",
    href: "/superadmin/billing",
    group: "core",
    enabled: true,
  },
  {
    id: "invoices",
    label: "Faktura og eksport",
    description: "Kjøringer og eksport.",
    href: "/superadmin/invoices",
    group: "core",
    enabled: true,
  },
  {
    id: "invoices-reconcile",
    label: "Avstemming",
    description: "Rekonsiliering av fakturagrunnlag.",
    href: "/superadmin/invoices/reconcile",
    group: "core",
    enabled: true,
  },
  // —— Operasjoner ——
  {
    id: "overview-dashboard",
    label: "Driftsoversikt",
    description: "KPI, firmaliste og systemtid — ikke det samme som kontrollsenteret.",
    href: "/superadmin/overview",
    group: "operations",
    enabled: true,
  },
  {
    id: "operations",
    label: "Operasjoner",
    description: "Operativ oversikt.",
    href: "/superadmin/operations",
    group: "operations",
    enabled: true,
  },
  {
    id: "system-operations",
    label: "System drift",
    description: "Driftsdashboard for system.",
    href: "/superadmin/system/operations",
    group: "operations",
    enabled: true,
  },
  {
    id: "outbox",
    label: "Utboks",
    description: "Utsendelser og kø.",
    href: "/superadmin/outbox",
    group: "operations",
    enabled: true,
  },
  // —— Vekst (CMS / marked) ——
  {
    id: "bo-content",
    label: "Innhold",
    description: "Sider og publisering.",
    href: "/backoffice/content",
    group: "growth",
    enabled: true,
  },
  {
    id: "bo-social-calendar",
    label: "Social kalender",
    description: "Lunchportalen — utkast, gjennomgang og plan (CMS).",
    href: "/backoffice/social",
    group: "growth",
    enabled: true,
  },
  {
    id: "bo-seo-growth",
    label: "SEO & vekst",
    description: "Sidevalg, metadata, analyse og forslag (CMS).",
    href: "/backoffice/seo-growth",
    group: "growth",
    enabled: true,
  },
  {
    id: "bo-esg",
    label: "ESG (CMS)",
    description: "Bærekraft — snapshot-basert lesing i backoffice.",
    href: "/backoffice/esg",
    group: "growth",
    enabled: true,
  },
  {
    id: "bo-ai",
    label: "AI",
    description: "AI-jobs og overvåkning.",
    href: "/backoffice/ai",
    group: "growth",
    enabled: true,
  },
  {
    id: "bo-ai-control",
    label: "AI kontrolltårn",
    description: "Kontroll av AI-flater.",
    href: "/backoffice/ai-control",
    group: "growth",
    enabled: true,
  },
  {
    id: "bo-experiments",
    label: "Eksperimenter",
    description: "A/B og vekstforsøk.",
    href: "/backoffice/experiments",
    group: "growth",
    enabled: true,
  },
  {
    id: "bo-design",
    label: "Design",
    description: "Design og merkevare i CMS.",
    href: "/backoffice/design",
    group: "growth",
    enabled: true,
  },
  {
    id: "bo-intelligence",
    label: "Intelligens",
    description: "Innsikt og signaler.",
    href: "/backoffice/intelligence",
    group: "growth",
    enabled: true,
  },
  {
    id: "bo-media",
    label: "Medier",
    description: "Media og filer.",
    href: "/backoffice/media",
    group: "growth",
    enabled: true,
  },
  {
    id: "bo-releases",
    label: "Utgivelser",
    description: "Releases og endringslogg.",
    href: "/backoffice/releases",
    group: "growth",
    enabled: true,
  },
  {
    id: "bo-enterprise",
    label: "Konsern (CMS)",
    description: "Konsern i backoffice (innhold).",
    href: "/backoffice/enterprise",
    group: "growth",
    enabled: true,
  },
  {
    id: "bo-settings",
    label: "Innstillinger",
    description: "Backoffice-innstillinger.",
    href: "/backoffice/settings",
    group: "growth",
    enabled: true,
  },
  {
    id: "bo-security",
    label: "Sikkerhet",
    description: "Sikkerhetsflate i backoffice.",
    href: "/backoffice/security",
    group: "growth",
    enabled: true,
  },
  {
    id: "bo-control",
    label: "Kontroll",
    description: "Sentral kontroll i backoffice.",
    href: "/backoffice/control",
    group: "growth",
    enabled: true,
  },
  {
    id: "ai-social-engine",
    label: "SoMe & AI Motor",
    description: "Automatisert innholdsproduksjon, publisering og læring",
    href: "/superadmin/growth/social",
    group: "growth",
    enabled: true,
  },
  // —— System ——
  {
    id: "system",
    label: "Systemhelse",
    description: "Status, flytdiagnostikk og miljø — ikke kontrolltårnet.",
    href: "/superadmin/system",
    group: "system",
    enabled: true,
  },
  {
    id: "control-tower",
    label: "Kontrolltårn",
    description: "Sanntidssignaler (ordre, prognoser, AI-status) — ikke systemhelse-siden.",
    href: "/superadmin/control-tower",
    group: "system",
    enabled: true,
  },
  {
    id: "autonomy",
    label: "Autonom modus",
    description: "Policy, tak og simulering — trygg standard av",
    href: "/superadmin/autonomy",
    group: "system",
    enabled: true,
  },
  {
    id: "audit",
    label: "Revisjon",
    description: "Revisjonslogg og hendelser.",
    href: "/superadmin/audit",
    group: "system",
    enabled: true,
  },
  {
    id: "esg",
    label: "ESG",
    description: "Bærekraft og rapporter.",
    href: "/superadmin/esg",
    group: "system",
    enabled: true,
  },
  {
    id: "cfo",
    label: "CFO",
    description: "Økonomisk oversikt (readonly).",
    href: "/superadmin/cfo",
    group: "system",
    enabled: true,
  },
];

const GROUP_ORDER: SuperadminCapability["group"][] = ["core", "operations", "growth", "system"];

const GROUP_LABELS: Record<SuperadminCapability["group"], string> = {
  core: "Kjerne",
  operations: "Operasjoner",
  growth: "Vekst",
  system: "System",
};

export function capabilitiesByGroup(): { group: SuperadminCapability["group"]; label: string; items: SuperadminCapability[] }[] {
  return GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    items: capabilities.filter((c) => c.enabled && c.group === group),
  })).filter((g) => g.items.length > 0);
}

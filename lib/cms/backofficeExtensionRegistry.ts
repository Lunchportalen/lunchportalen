/**
 * CP13 — Kanonisk Bellissima-lignende extension registry for backoffice.
 * Én kilde for TopBar, command palette og manifest-metadata (section → workspace entry).
 * Konsoliderer tidligere `backofficeNavItems` uten parallell struktur.
 *
 * Referanse (Umbraco 17): extension manifest, sections, workspace entry points — se docs/umbraco-parity/CP13_*.md
 */
import type { SemanticIconKey } from "@/lib/iconRegistry";

/** Rekkefølge i kommandopalett (fast). */
export type BackofficeNavGroupId = "control" | "runtime" | "domain" | "content" | "settings" | "system";

export const BACKOFFICE_NAV_GROUP_ORDER: readonly BackofficeNavGroupId[] = [
  "control",
  "runtime",
  "domain",
  "content",
  "settings",
  "system",
] as const;

export const BACKOFFICE_NAV_GROUP_LABEL: Record<BackofficeNavGroupId, string> = {
  control: "Kontroll & sikkerhet",
  runtime: "Enterprise & runtime",
  domain: "Domene & drift",
  content: "Innhold & vekst",
  settings: "CMS-innstillinger & schema",
  system: "Brukere & system",
};

export type BackofficeSectionPlane = "management" | "delivery";

export type BackofficeSectionDefinition = {
  id: BackofficeNavGroupId;
  label: string;
  description: string;
  primaryHref: string;
  plane: BackofficeSectionPlane;
};

export const BACKOFFICE_CONTENT_BASE_PATH = "/backoffice/content" as const;

/** Kanonisk base-URL for Settings-seksjonen (U29/U29R) — én sann sti, ingen duplikat. */
export const BACKOFFICE_SETTINGS_BASE_PATH = "/backoffice/settings" as const;

export const BACKOFFICE_SECTIONS: readonly BackofficeSectionDefinition[] = [
  {
    id: "control",
    label: BACKOFFICE_NAV_GROUP_LABEL.control,
    description: "Tilgang, sikkerhet, AI-governance og kontrolltårn.",
    primaryHref: "/backoffice/control",
    plane: "management",
  },
  {
    id: "runtime",
    label: BACKOFFICE_NAV_GROUP_LABEL.runtime,
    description: "Runtime-koblinger, status og enterprise-flater med operativ sannhet.",
    primaryHref: "/backoffice/runtime",
    plane: "delivery",
  },
  {
    id: "domain",
    label: BACKOFFICE_NAV_GROUP_LABEL.domain,
    description: "Domene- og driftsflater som peker trygt inn i runtime.",
    primaryHref: "/backoffice/domains",
    plane: "delivery",
  },
  {
    id: "content",
    label: BACKOFFICE_NAV_GROUP_LABEL.content,
    description:
      "Redaksjon for public nettsider og innhold (blueprint: Umbraco-spor) — tre, media, forhåndsvisning; ikke operativ eller meny-sannhet.",
    primaryHref: BACKOFFICE_CONTENT_BASE_PATH,
    plane: "delivery",
  },
  {
    id: "settings",
    label: BACKOFFICE_NAV_GROUP_LABEL.settings,
    description: "Document types, data types, create policy og management-governance i CMS.",
    primaryHref: BACKOFFICE_SETTINGS_BASE_PATH,
    plane: "management",
  },
  {
    id: "system",
    label: BACKOFFICE_NAV_GROUP_LABEL.system,
    description: "Brukere, medlemmer, oversettelser og systemadministrasjon.",
    primaryHref: "/backoffice/users",
    plane: "management",
  },
] as const;

export function getBackofficeSectionById(id: BackofficeNavGroupId): BackofficeSectionDefinition {
  return BACKOFFICE_SECTIONS.find((section) => section.id === id) ?? BACKOFFICE_SECTIONS[0]!;
}

/** U30R — Manifest-id for Settings i registry (kobles til TopBar/palett). */
export const BACKOFFICE_SETTINGS_EXTENSION_ID = "nav.settings" as const;

/** Umbraco Bellissima-lignende: workspace vs hjelpeflate vs verktøy. */
export type BackofficeExtensionKind = "workspace" | "surface" | "tool";

/**
 * Én registrert backoffice-utvidelse (manifest-lignende).
 * `domainSurfaceId` / `modulePostureId` kobler til eksisterende CP4–CP6 register — ingen ny sannhet.
 */
export type BackofficeExtensionEntry = {
  /** Stabil id, f.eks. `nav.content` eller `discovery.recycle-bin` */
  id: string;
  kind: BackofficeExtensionKind;
  /** Section (gruppe) — tilsvarer Umbraco section bucket */
  sectionId: BackofficeNavGroupId;
  label: string;
  href: string;
  iconName: SemanticIconKey;
  /** Tree/collection-nøkkel for dokumentasjon og workspace-paritet */
  collectionKey?: string;
  /** `CONTROL_PLANE_DOMAIN_ACTION_SURFACES[].id` når relevant */
  domainSurfaceId?: string;
  /** `MODULE_LIVE_POSTURE_REGISTRY[].id` når relevant */
  modulePostureId?: string;
  /** Hvor flata vises */
  surface: { topBar: boolean; palette: boolean };
  /**
   * U31 — Styringsplan vs leveranse (management = schema/settings/governance surfaces).
   * Brukes til navigasjonshint — ingen ny sannhet.
   */
  managementPlane?: boolean;
  /**
   * U18 — Ekstra trekkord for command palette (client-side filter, ingen indeksmotor).
   */
  discoveryAliases?: string[];
};

export type BackofficeNavItem = {
  label: string;
  href: string;
  iconName: SemanticIconKey;
  groupId: BackofficeNavGroupId;
  /** CP13 — sporbar kobling til manifest */
  extensionId?: string;
};

export type BackofficeWorkspaceViewLink = {
  id?: string;
  href: string;
  label: string;
  exact?: boolean;
  description?: string;
  kind?: "overview" | "collection" | "workspace";
};

export const BACKOFFICE_CONTENT_WORKSPACE_VIEWS: readonly BackofficeWorkspaceViewLink[] = [
  {
    id: "overview",
    href: BACKOFFICE_CONTENT_BASE_PATH,
    label: "Oversikt",
    exact: true,
    description: "Tree-first entry med oversikt og trygg routing inn i editoren.",
    kind: "overview",
  },
  {
    id: "growth",
    href: `${BACKOFFICE_CONTENT_BASE_PATH}/growth`,
    label: "Vekst & innsikt",
    description: "Sekundær arbeidsflate for innsikt og vekstsignaler.",
    kind: "workspace",
  },
  {
    id: "recycle-bin",
    href: `${BACKOFFICE_CONTENT_BASE_PATH}/recycle-bin`,
    label: "Papirkurv",
    description: "Livssyklusflate for slettet innhold.",
    kind: "workspace",
  },
] as const;

export type BackofficeSettingsCollectionId =
  | "overview"
  | "compositions"
  | "document-types"
  | "element-types"
  | "data-types"
  | "block-editor-data-types"
  | "create-policy"
  | "schema"
  | "governance-insights"
  | "management-read"
  | "languages"
  | "ai-governance"
  | "system";

export type BackofficeSettingsObjectClass =
  | "section"
  | "composition"
  | "document_type"
  | "element_type"
  | "data_type"
  | "policy"
  | "schema"
  | "registry"
  | "governance"
  | "system";

export type BackofficeSettingsFlowKind =
  | "overview"
  | "collection_to_detail"
  | "workspace_read"
  | "runtime_read"
  | "runtime_manage";

export type BackofficeSettingsCollectionDefinition = {
  id: BackofficeSettingsCollectionId;
  label: string;
  href: string;
  groupLabel: string;
  description: string;
  honesty: "code_governed" | "runtime_read" | "runtime_managed";
  kind: "overview" | "collection" | "workspace";
  objectClass: BackofficeSettingsObjectClass;
  flowKind: BackofficeSettingsFlowKind;
  exact?: boolean;
};

export const BACKOFFICE_SETTINGS_COLLECTIONS: readonly BackofficeSettingsCollectionDefinition[] = [
  {
    id: "overview",
    label: "Oversikt",
    href: BACKOFFICE_SETTINGS_BASE_PATH,
    groupLabel: "Start",
    description: "Section hub med innganger til de viktigste styringsflatene.",
    honesty: "code_governed",
    kind: "overview",
    objectClass: "section",
    flowKind: "overview",
    exact: true,
  },
  {
    id: "compositions",
    label: "Compositions",
    href: `${BACKOFFICE_SETTINGS_BASE_PATH}/compositions`,
    groupLabel: "Type & opprettelse",
    description: "Samling av delte composition-definisjoner (gjenbrukte grupper og properties).",
    honesty: "runtime_managed",
    kind: "collection",
    objectClass: "composition",
    flowKind: "collection_to_detail",
  },
  {
    id: "document-types",
    label: "Document types",
    href: `${BACKOFFICE_SETTINGS_BASE_PATH}/document-types`,
    groupLabel: "Type & opprettelse",
    description: "Samling av dokumenttyper og workspace-detaljer per type.",
    honesty: "code_governed",
    kind: "collection",
    objectClass: "document_type",
    flowKind: "collection_to_detail",
  },
  {
    id: "element-types",
    label: "Element types",
    href: `${BACKOFFICE_SETTINGS_BASE_PATH}/element-types`,
    groupLabel: "Type & opprettelse",
    description:
      "Umbraco-lignende elementtyper (block entries): innhold, settings-modell, property editor og canvas view — code-governed, referert fra data types.",
    honesty: "code_governed",
    kind: "collection",
    objectClass: "element_type",
    flowKind: "collection_to_detail",
  },
  {
    id: "data-types",
    label: "Data types",
    href: `${BACKOFFICE_SETTINGS_BASE_PATH}/data-types`,
    groupLabel: "Type & opprettelse",
    description: "Samling av property editor-kinds brukt i blokk-skjemaene.",
    honesty: "code_governed",
    kind: "collection",
    objectClass: "data_type",
    flowKind: "collection_to_detail",
  },
  {
    id: "block-editor-data-types",
    label: "Block Editor Data Types",
    href: `${BACKOFFICE_SETTINGS_BASE_PATH}/block-editor-data-types`,
    groupLabel: "Type & opprettelse",
    description:
      "Umbraco-lignende data types for blokkeditoren: allowlist, grupper, grenser og create-label — lagret i settings og brukt i content-editoren.",
    honesty: "runtime_managed",
    kind: "collection",
    objectClass: "data_type",
    flowKind: "collection_to_detail",
  },
  {
    id: "create-policy",
    label: "Create policy",
    href: `${BACKOFFICE_SETTINGS_BASE_PATH}/create-policy`,
    groupLabel: "Type & opprettelse",
    description: "Workspace for allowlists, opprettelsesregler og tree-policy.",
    honesty: "code_governed",
    kind: "workspace",
    objectClass: "policy",
    flowKind: "workspace_read",
  },
  {
    id: "schema",
    label: "Schema (samlet)",
    href: `${BACKOFFICE_SETTINGS_BASE_PATH}/schema`,
    groupLabel: "Type & opprettelse",
    description: "Samlet read-model for dokumenttyper, data types og create policy.",
    honesty: "code_governed",
    kind: "workspace",
    objectClass: "schema",
    flowKind: "workspace_read",
  },
  {
    id: "governance-insights",
    label: "Governance & bruk",
    href: `${BACKOFFICE_SETTINGS_BASE_PATH}/governance-insights`,
    groupLabel: "Governance & drift",
    description: "Analyse, legacy-dekning og eksplisitt batch-normalisering med ærlig posture.",
    honesty: "runtime_read",
    kind: "workspace",
    objectClass: "governance",
    flowKind: "runtime_read",
  },
  {
    id: "management-read",
    label: "Management read",
    href: `${BACKOFFICE_SETTINGS_BASE_PATH}/management-read`,
    groupLabel: "Governance & drift",
    description: "Read-only management API-lignende leseflate mot kode-registry.",
    honesty: "code_governed",
    kind: "workspace",
    objectClass: "registry",
    flowKind: "workspace_read",
  },
  {
    id: "languages",
    label: "Språk (CMS)",
    href: `${BACKOFFICE_SETTINGS_BASE_PATH}/languages`,
    groupLabel: "Governance & drift",
    description: "Kulturkoder, aktive språk og default for variant-rader (nb/en) — persisted i settings.",
    honesty: "runtime_managed",
    kind: "collection",
    objectClass: "registry",
    flowKind: "collection_to_detail",
  },
  {
    id: "ai-governance",
    label: "AI governance",
    href: `${BACKOFFICE_SETTINGS_BASE_PATH}/ai-governance`,
    groupLabel: "Governance & drift",
    description: "Styring, posture, operatorflyt og trygge koblinger til AI Center og systemtoggle.",
    honesty: "runtime_read",
    kind: "workspace",
    objectClass: "governance",
    flowKind: "workspace_read",
  },
  {
    id: "system",
    label: "System & drift",
    href: `${BACKOFFICE_SETTINGS_BASE_PATH}/system`,
    groupLabel: "Governance & drift",
    description: "Driftsnær settings-surface med runtime-nære signaler og kontrollert persisted styring.",
    honesty: "runtime_managed",
    kind: "workspace",
    objectClass: "system",
    flowKind: "runtime_manage",
  },
] as const;

function toSettingsWorkspaceView(
  entry: BackofficeSettingsCollectionDefinition,
): BackofficeWorkspaceViewLink {
  return {
    id: entry.id,
    href: entry.href,
    label: entry.label,
    exact: entry.exact,
    description: entry.description,
    kind: entry.kind,
  };
}

export const BACKOFFICE_SETTINGS_WORKSPACE_VIEWS: readonly BackofficeWorkspaceViewLink[] =
  BACKOFFICE_SETTINGS_COLLECTIONS.map(toSettingsWorkspaceView);

export type BackofficeContentEntityWorkspaceViewId = "content" | "preview" | "history" | "global" | "design";

export type BackofficeContentEntityWorkspaceViewDefinition = {
  id: BackofficeContentEntityWorkspaceViewId;
  label: string;
  description: string;
};

export const BACKOFFICE_CONTENT_ENTITY_WORKSPACE_VIEWS: readonly BackofficeContentEntityWorkspaceViewDefinition[] = [
  {
    id: "content",
    label: "Innhold",
    description: "Primær editorflate med struktur, canvas og inspector.",
  },
  {
    id: "preview",
    label: "Forhåndsvisning",
    description: "Stor sekundærflate med samme renderer som offentlig side.",
  },
  {
    id: "history",
    label: "Historikk",
    description: "Versjoner, audit og governance-status for aktiv entitet.",
  },
  {
    id: "global",
    label: "Global",
    description: "Globalt innhold og delte flater for redaksjonell styring.",
  },
  {
    id: "design",
    label: "Design",
    description: "Design-scope og sidevisningskontroller.",
  },
] as const;

export function getBackofficeSettingsCollectionById(
  id: BackofficeSettingsCollectionId
): BackofficeSettingsCollectionDefinition {
  return BACKOFFICE_SETTINGS_COLLECTIONS.find((item) => item.id === id) ?? BACKOFFICE_SETTINGS_COLLECTIONS[0]!;
}

export function getBackofficeSettingsCollectionsByGroup(): readonly {
  groupLabel: string;
  items: readonly BackofficeSettingsCollectionDefinition[];
}[] {
  const groups = new Map<string, BackofficeSettingsCollectionDefinition[]>();
  for (const item of BACKOFFICE_SETTINGS_COLLECTIONS) {
    const existing = groups.get(item.groupLabel) ?? [];
    existing.push(item);
    groups.set(item.groupLabel, existing);
  }
  return Array.from(groups.entries()).map(([groupLabel, items]) => ({ groupLabel, items }));
}

export function getBackofficeContentEntityWorkspaceView(
  id: BackofficeContentEntityWorkspaceViewId
): BackofficeContentEntityWorkspaceViewDefinition {
  return (
    BACKOFFICE_CONTENT_ENTITY_WORKSPACE_VIEWS.find((view) => view.id === id) ??
    BACKOFFICE_CONTENT_ENTITY_WORKSPACE_VIEWS[0]!
  );
}

const ENTRIES: BackofficeExtensionEntry[] = [
  {
    id: "nav.control",
    kind: "workspace",
    sectionId: "control",
    label: "Control",
    href: "/backoffice/control",
    iconName: "shield",
    collectionKey: "controlPlane",
    surface: { topBar: true, palette: true },
  },
  {
    id: "nav.security",
    kind: "workspace",
    sectionId: "control",
    label: "Security",
    href: "/backoffice/security",
    iconName: "lock",
    collectionKey: "security",
    surface: { topBar: true, palette: true },
  },
  {
    id: "nav.ai-tower",
    kind: "workspace",
    sectionId: "control",
    label: "AI Center",
    href: "/backoffice/ai-control",
    iconName: "ai",
    collectionKey: "aiGovernance",
    modulePostureId: "worker_jobs",
    surface: { topBar: true, palette: true },
  },
  {
    id: "nav.enterprise",
    kind: "workspace",
    sectionId: "runtime",
    label: "Enterprise",
    href: "/backoffice/enterprise",
    iconName: "invoice",
    collectionKey: "enterprise",
    surface: { topBar: true, palette: true },
  },
  {
    id: "nav.runtime",
    kind: "workspace",
    sectionId: "runtime",
    label: "Runtime",
    href: "/backoffice/runtime",
    iconName: "company",
    collectionKey: "runtimeOverview",
    surface: { topBar: true, palette: true },
  },
  {
    id: "nav.domains",
    kind: "workspace",
    sectionId: "domain",
    label: "Domener",
    href: "/backoffice/domains",
    iconName: "folder",
    collectionKey: "domains",
    surface: { topBar: true, palette: true },
    discoveryAliases: ["domain", "dns", "vert"],
  },
  {
    id: "nav.customers",
    kind: "workspace",
    sectionId: "domain",
    label: "Kunder",
    href: "/backoffice/customers",
    iconName: "users",
    collectionKey: "customers",
    domainSurfaceId: "companies_customers",
    modulePostureId: "company_agreement_location_surfaces",
    surface: { topBar: true, palette: true },
  },
  {
    id: "nav.agreement-runtime",
    kind: "workspace",
    sectionId: "domain",
    label: "Avtale",
    href: "/backoffice/agreement-runtime",
    iconName: "invoice",
    collectionKey: "agreement",
    domainSurfaceId: "agreement_runtime",
    modulePostureId: "company_agreement_location_surfaces",
    surface: { topBar: true, palette: true },
  },
  {
    id: "nav.week-menu",
    kind: "workspace",
    sectionId: "domain",
    label: "Uke & meny",
    href: "/backoffice/week-menu",
    iconName: "menu",
    collectionKey: "weekMenu",
    domainSurfaceId: "week_menu",
    modulePostureId: "operational_week_menu_governance",
    surface: { topBar: true, palette: true },
    discoveryAliases: ["uke", "meny", "week", "sanity", "publiser"],
  },
  {
    id: "nav.content",
    kind: "workspace",
    sectionId: "content",
    label: "Content",
    href: "/backoffice/content",
    iconName: "content",
    collectionKey: "contentTree",
    domainSurfaceId: "content_publish",
    surface: { topBar: true, palette: true },
    discoveryAliases: ["innhold", "sider", "tree", "side", "forside", "postgres"],
  },
  {
    id: "nav.seo-growth",
    kind: "workspace",
    sectionId: "content",
    label: "SEO",
    href: "/backoffice/seo-growth",
    iconName: "seo",
    collectionKey: "seoGrowth",
    domainSurfaceId: "seo",
    modulePostureId: "seo_growth",
    surface: { topBar: true, palette: true },
    discoveryAliases: ["søk", "metadata", "vekst", "growth"],
  },
  {
    id: "nav.social",
    kind: "workspace",
    sectionId: "content",
    label: "Social",
    href: "/backoffice/social",
    iconName: "globe",
    collectionKey: "social",
    domainSurfaceId: "social",
    modulePostureId: "social_calendar",
    surface: { topBar: true, palette: true },
    discoveryAliases: ["sosiale", "linkedin", "publish"],
  },
  {
    id: "nav.esg",
    kind: "workspace",
    sectionId: "content",
    label: "ESG",
    href: "/backoffice/esg",
    iconName: "company",
    collectionKey: "esg",
    domainSurfaceId: "esg",
    modulePostureId: "esg",
    surface: { topBar: true, palette: true },
    discoveryAliases: ["bærekraft", "miljø", "co2"],
  },
  {
    id: "nav.intelligence",
    kind: "surface",
    sectionId: "content",
    label: "Intelligence",
    href: "/backoffice/intelligence",
    iconName: "ai",
    collectionKey: "intelligence",
    surface: { topBar: true, palette: true },
  },
  {
    id: "nav.releases",
    kind: "surface",
    sectionId: "content",
    label: "Releases",
    href: "/backoffice/releases",
    iconName: "releases",
    collectionKey: "releases",
    surface: { topBar: true, palette: true },
  },
  {
    id: "nav.media",
    kind: "workspace",
    sectionId: "content",
    label: "Media",
    href: "/backoffice/media",
    iconName: "media",
    collectionKey: "media",
    surface: { topBar: true, palette: true },
    discoveryAliases: ["bilder", "filer", "assets", "video"],
  },
  {
    id: "nav.templates",
    kind: "workspace",
    sectionId: "content",
    label: "Templates",
    href: "/backoffice/templates",
    iconName: "template",
    collectionKey: "templates",
    surface: { topBar: true, palette: true },
  },
  {
    id: "nav.users",
    kind: "workspace",
    sectionId: "system",
    label: "Users",
    href: "/backoffice/users",
    iconName: "users",
    collectionKey: "users",
    surface: { topBar: true, palette: true },
  },
  {
    id: "nav.members",
    kind: "workspace",
    sectionId: "system",
    label: "Members",
    href: "/backoffice/members",
    iconName: "employee",
    collectionKey: "members",
    surface: { topBar: true, palette: true },
  },
  {
    id: "nav.forms",
    kind: "workspace",
    sectionId: "system",
    label: "Forms",
    href: "/backoffice/forms",
    iconName: "form",
    collectionKey: "forms",
    surface: { topBar: true, palette: true },
  },
  {
    id: "nav.translation",
    kind: "workspace",
    sectionId: "system",
    label: "Translation",
    href: "/backoffice/translation",
    iconName: "translation",
    collectionKey: "translation",
    surface: { topBar: true, palette: true },
  },
  {
    id: "nav.settings",
    kind: "workspace",
    sectionId: "settings",
    label: "Settings",
    href: BACKOFFICE_SETTINGS_BASE_PATH,
    iconName: "settings",
    collectionKey: "settings",
    managementPlane: true,
    surface: { topBar: true, palette: true },
    discoveryAliases: ["innstillinger", "settings", "schema", "dokumenttype", "datatype", "system"],
  },
  {
    id: "discovery.recycle-bin",
    kind: "tool",
    sectionId: "content",
    label: "Papirkurv (innhold)",
    href: "/backoffice/content/recycle-bin",
    iconName: "content",
    collectionKey: "recycleBin",
    domainSurfaceId: "content_publish",
    surface: { topBar: false, palette: true },
  },
  {
    id: "discovery.control-tower",
    kind: "tool",
    sectionId: "control",
    label: "Control tower",
    href: "/backoffice/control-tower",
    iconName: "shield",
    collectionKey: "controlTower",
    surface: { topBar: false, palette: true },
    discoveryAliases: ["kontrolltårn", "overview"],
  },
  {
    id: "discovery.tower-company-admin",
    kind: "tool",
    sectionId: "runtime",
    label: "Company admin (tårn)",
    href: "/admin",
    iconName: "users",
    collectionKey: "towerCompanyAdmin",
    domainSurfaceId: "company_admin_tower",
    modulePostureId: "company_admin_tower",
    surface: { topBar: false, palette: true },
    discoveryAliases: ["tårn", "tower", "firma", "ansatte", "bedrift", "company"],
  },
  {
    id: "discovery.tower-kitchen",
    kind: "tool",
    sectionId: "runtime",
    label: "Kitchen (tårn)",
    href: "/kitchen",
    iconName: "company",
    collectionKey: "towerKitchen",
    domainSurfaceId: "kitchen_tower",
    modulePostureId: "kitchen_tower",
    surface: { topBar: false, palette: true },
    discoveryAliases: ["tårn", "kjøkken", "kitchen", "produksjon"],
  },
  {
    id: "discovery.tower-driver",
    kind: "tool",
    sectionId: "runtime",
    label: "Driver (tårn)",
    href: "/driver",
    iconName: "users",
    collectionKey: "towerDriver",
    domainSurfaceId: "driver_tower",
    modulePostureId: "driver_tower",
    surface: { topBar: false, palette: true },
    discoveryAliases: ["tårn", "sjåfør", "leveranse", "driver"],
  },
  {
    id: "discovery.tower-superadmin",
    kind: "tool",
    sectionId: "control",
    label: "Superadmin (tårn)",
    href: "/superadmin/overview",
    iconName: "shield",
    collectionKey: "towerSuperadmin",
    domainSurfaceId: "superadmin_tower",
    modulePostureId: "superadmin_tower",
    surface: { topBar: false, palette: true },
    discoveryAliases: ["tårn", "plattform", "superadmin", "system"],
  },
];

/** Kanonisk manifest — én sann liste. */
export const BACKOFFICE_EXTENSION_REGISTRY: readonly BackofficeExtensionEntry[] = ENTRIES;

/**
 * U31 — Maks antall synlige modul-lenker per seksjon før «Flere»-overflow.
 * Reduserer horisontal pill-støy; resten ligger i sekundær meny.
 */
export const BACKOFFICE_TOPBAR_MODULE_OVERFLOW = 2 as const;

let paletteSearchByHrefMemo: Map<string, string> | null = null;

function getPaletteSearchStringByHref(): Map<string, string> {
  if (!paletteSearchByHrefMemo) {
    const m = new Map<string, string>();
    for (const e of ENTRIES) {
      if (!e.surface.palette) continue;
      const parts = [e.label, e.href, e.collectionKey ?? "", e.id, ...(e.discoveryAliases ?? [])];
      m.set(e.href, parts.join(" ").toLowerCase());
    }
    paletteSearchByHrefMemo = m;
  }
  return paletteSearchByHrefMemo;
}

function toNavItem(e: BackofficeExtensionEntry): BackofficeNavItem {
  return {
    label: e.label,
    href: e.href,
    iconName: e.iconName,
    groupId: e.sectionId,
    extensionId: e.id,
  };
}

/** Aktiv fane: eksakt treff eller understi (samme regel som tidligere TopBar-spesialtilfeller). */
export function isBackofficeNavActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function getBackofficeNavItemsForTopBar(): BackofficeNavItem[] {
  return ENTRIES.filter((e) => e.surface.topBar).map(toNavItem);
}

function mergePaletteEntries(): BackofficeNavItem[] {
  const seen = new Set<string>();
  const out: BackofficeNavItem[] = [];
  for (const e of ENTRIES) {
    if (!e.surface.palette) continue;
    if (seen.has(e.href)) continue;
    seen.add(e.href);
    out.push(toNavItem(e));
  }
  return out;
}

/** Palett (TopBar + discovery-only entries), deduplisert på href. */
export const BACKOFFICE_PALETTE_ITEMS: BackofficeNavItem[] = mergePaletteEntries();

/** TopBar — primær navigasjon */
export const BACKOFFICE_NAV_ITEMS: BackofficeNavItem[] = getBackofficeNavItemsForTopBar();

/** Grupperer filtrert liste uten å endre rekkefølge innenfor gruppe (beholder `filtered`-orden). */
export function groupFilteredBackofficeNavItems(filtered: readonly BackofficeNavItem[]): {
  groupId: BackofficeNavGroupId;
  label: string;
  items: BackofficeNavItem[];
}[] {
  const out: { groupId: BackofficeNavGroupId; label: string; items: BackofficeNavItem[] }[] = [];
  for (const gid of BACKOFFICE_NAV_GROUP_ORDER) {
    const items = filtered.filter((x) => x.groupId === gid);
    if (items.length) out.push({ groupId: gid, label: BACKOFFICE_NAV_GROUP_LABEL[gid], items });
  }
  return out;
}

/** Client-side filter for command palette (CP10, U18 aliases) — ingen server-indeks. */
export function filterBackofficeNavItems(items: readonly BackofficeNavItem[], query: string): BackofficeNavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  const searchMap = getPaletteSearchStringByHref();
  return items.filter((item) => {
    const blob = searchMap.get(item.href) ?? "";
    return (
      item.label.toLowerCase().includes(q) ||
      item.href.toLowerCase().includes(q) ||
      item.href.replace(/^\/backoffice\/?/, "").toLowerCase().includes(q) ||
      blob.includes(q)
    );
  });
}

export function getBackofficeExtensionById(id: string): BackofficeExtensionEntry | undefined {
  return ENTRIES.find((e) => e.id === id);
}

export function getBackofficeExtensionByHref(href: string): BackofficeExtensionEntry | undefined {
  return ENTRIES.find((e) => e.href === href);
}

/**
 * U17 — Matcher lengste `href` først slik at under-ruter (f.eks. papirkurv) får riktig workspace-manifest.
 */
export function findBackofficeExtensionForPathname(pathname: string): BackofficeExtensionEntry | undefined {
  if (!pathname.startsWith("/backoffice")) return undefined;
  const sorted = [...ENTRIES].sort((a, b) => b.href.length - a.href.length);
  for (const e of sorted) {
    if (pathname === e.href || pathname.startsWith(`${e.href}/`)) return e;
  }
  return undefined;
}

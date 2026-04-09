/**
 * CP4/CP5/CP6 — felles domain action surfaces (ingen ny runtime-sannhet).
 * CP5: actionRouting (les/skriv/publish-control).
 * CP6: whyMatters — eksplisitt «hvorfor dette betyr noe» for operativ kontroll.
 */

export type DomainMutationPosture = "read_only" | "review" | "runtime_route";

export type DomainActionRoutingMeta = {
  reads: string[];
  writes: string[];
  affects?: string;
  publishControl?: string;
  /** CP6: kort «hvorfor» for handlingsorientert kontroll */
  whyMatters?: string;
};

export type ControlPlaneDomainActionSurface = {
  id: string;
  title: string;
  description: string;
  sourceOfTruth: string;
  cmsSurfaceHref: string;
  mutationPosture: DomainMutationPosture;
  postureLabel: string;
  actions: Array<{ label: string; href: string; external?: boolean }>;
  actionRouting?: DomainActionRoutingMeta;
};

export const CONTROL_PLANE_DOMAIN_ACTION_SURFACES: ControlPlaneDomainActionSurface[] = [
  {
    id: "companies_customers",
    title: "Firma & kunder",
    description: "Read-only speil av companies + lokasjonstelling. Mutasjon i superadmin.",
    sourceOfTruth: "Supabase companies, company_locations",
    cmsSurfaceHref: "/backoffice/customers",
    mutationPosture: "runtime_route",
    postureLabel: "Mutasjon via superadmin",
    actions: [
      { label: "Åpne kunder & avtaler", href: "/backoffice/customers" },
      { label: "Superadmin — firma", href: "/superadmin/companies" },
    ],
    actionRouting: {
      reads: ["companies", "company_locations (telling)"],
      writes: ["Superadmin firmaflyt / eksisterende superadmin-API"],
      affects: "Kundelivssyklus, lokasjoner, aktivering",
      publishControl: "Ikke CMS Postgres-publish — styres i superadmin",
      whyMatters: "Feil firmastatus eller lokasjon påvirker ordre, tilgang og fakturagrunnlag — superadmin er sannhet.",
    },
  },
  {
    id: "agreement_runtime",
    title: "Avtale-runtime (innsyn)",
    description: "Avtalefelt speilet fra JSON + plan der normalizeAgreement treffer. Full redigering i operative flater.",
    sourceOfTruth: "company_current_agreement, agreements, agreement_json",
    cmsSurfaceHref: "/backoffice/agreement-runtime",
    mutationPosture: "review",
    postureLabel: "Review → superadmin/admin",
    actions: [
      { label: "Avtale-runtime side", href: "/backoffice/agreement-runtime" },
      { label: "Superadmin — firma", href: "/superadmin/companies" },
      { label: "Company admin — avtale", href: "/admin/agreement" },
    ],
    actionRouting: {
      reads: ["agreement_json", "company_current_agreement"],
      writes: ["Company admin /api/admin/agreement", "Superadmin-avtaleflyt"],
      affects: "Leveringsdager, tier, pris for eget selskap",
      publishControl: "Runtime-ruter — ikke backoffice content publish",
      whyMatters: "Avtale styrer hva ansatte kan bestille og til hvilken pris — endring kun via godkjente admin-ruter.",
    },
  },
  {
    id: "week_menu",
    title: "Uke & meny (operativ kjede)",
    description: "GET /api/week + Sanity menu/menuContent. weekPlan er eget editorial-spor.",
    sourceOfTruth: "GET /api/week, Sanity menu/menuContent",
    cmsSurfaceHref: "/backoffice/week-menu",
    mutationPosture: "runtime_route",
    postureLabel: "Meny i Studio · ikke duplikat CMS-DB",
    actions: [
      { label: "Uke & meny", href: "/backoffice/week-menu" },
      { label: "Runtime-oversikt", href: "/backoffice/runtime" },
    ],
    actionRouting: {
      reads: ["GET /api/week", "Sanity menu/menuContent", "company_current_agreement"],
      writes: ["Sanity Studio (menydokumenter)", "POST /api/backoffice/sanity/menu-content/publish (superadmin + SANITY_WRITE_TOKEN)"],
      affects: "Ansatte — synlig uke og bestilling",
      publishControl:
        "Operativ meny publiseres via Sanity (Studio eller server-broker) — samme Actions-kilde som API leser publisert",
      whyMatters: "Uten publiserte menydokumenter og gyldig avtale får ikke ansatte riktig operativ meny.",
    },
  },
  {
    id: "content_publish",
    title: "Innhold & publish",
    description: "Postgres-sider, preview og publish i content workspace.",
    sourceOfTruth: "Postgres content pages",
    cmsSurfaceHref: "/backoffice/content",
    mutationPosture: "review",
    postureLabel: "Publish-kontroll i workspace",
    actions: [{ label: "Content", href: "/backoffice/content" }],
    actionRouting: {
      reads: ["Postgres content pages, varianter"],
      writes: ["Content workspace publish/preview"],
      affects: "Offentlige sider / forside",
      publishControl: "Backoffice content workspace",
      whyMatters: "Publish her påvirker synlig innhold — ikke samme som Sanity-meny.",
    },
  },
  {
    id: "company_admin_tower",
    title: "Company admin (tårn)",
    description: "Operativ admin for eget selskap — ordre, avtale, ansatte.",
    sourceOfTruth: "profiles.company_id, admin routes",
    cmsSurfaceHref: "/admin",
    mutationPosture: "runtime_route",
    postureLabel: "Runtime · company_admin",
    actions: [{ label: "Åpne admin", href: "/admin" }],
    actionRouting: {
      reads: ["Eget company_id (server)", "ordre, avtale, ansatte innen scope"],
      writes: ["Eksisterende /api/admin/* innen eget selskap"],
      affects: "Drift for ett selskap — ikke cross-tenant",
      publishControl: "Ikke CMS control plane publish — egen admin-sannhet",
      whyMatters: "Dette er daglig operativ kontroll for kunden — isolert fra andre selskap.",
    },
  },
  {
    id: "kitchen_tower",
    title: "Kitchen (tårn)",
    description: "Produksjonsvisning — tenant-sannhet.",
    sourceOfTruth: "orders, kitchen routes",
    cmsSurfaceHref: "/kitchen",
    mutationPosture: "runtime_route",
    postureLabel: "Runtime · kitchen",
    actions: [{ label: "Åpne kitchen", href: "/kitchen" }],
    actionRouting: {
      reads: ["Ordre gruppert per tenant/slot (kjøkken-sannhet)"],
      writes: ["Kun der kjøkken-ruter tillater — ellers read-only"],
      affects: "Produksjon og utlevering denne dagen",
      publishControl: "Ikke innholdspublish — operativ visning",
      whyMatters: "Kjøkken må se riktig tenant og volum under tidspress.",
    },
  },
  {
    id: "driver_tower",
    title: "Driver (tårn)",
    description: "Leveranseruter og stopp.",
    sourceOfTruth: "driver routes, orders",
    cmsSurfaceHref: "/driver",
    mutationPosture: "runtime_route",
    postureLabel: "Runtime · driver",
    actions: [{ label: "Åpne driver", href: "/driver" }],
    actionRouting: {
      reads: ["Stopplister fra ordre (tenant-scope)"],
      writes: ["Leveransehandlinger der API finnes"],
      affects: "Utkjøring og bekreftelse",
      publishControl: "Operativ — ikke CMS publish",
      whyMatters: "Sjåfør trenger deterministisk liste — samme ordre-sannhet som kjøkken.",
    },
  },
  {
    id: "superadmin_tower",
    title: "Superadmin (tårn)",
    description: "Systemhub, firma, faktura, helse.",
    sourceOfTruth: "superadmin APIs",
    cmsSurfaceHref: "/superadmin/overview",
    mutationPosture: "runtime_route",
    postureLabel: "Runtime · superadmin",
    actions: [
      { label: "Oversikt", href: "/superadmin/overview" },
      { label: "Systemhelse", href: "/superadmin/system" },
    ],
    actionRouting: {
      reads: ["Systemaggregater, firma, faktura (superadmin scope)"],
      writes: ["Superadmin API der rolle tillater"],
      affects: "Hele plattformen — høy risiko ved feil",
      publishControl: "Systemhandlinger — ikke blandet med content publish",
      whyMatters: "Globale endringer påvirker alle kunder — kun superadmin.",
    },
  },
  {
    id: "seo",
    title: "SEO / vekst",
    description: "Review-first; batch og editor — ikke full auto-publish.",
    sourceOfTruth: "SEO routes + content",
    cmsSurfaceHref: "/backoffice/seo-growth",
    mutationPosture: "review",
    postureLabel: "LIMITED",
    actions: [{ label: "SEO / vekst", href: "/backoffice/seo-growth" }],
    actionRouting: {
      reads: ["Content-varianter, SEO-anbefalinger"],
      writes: ["Review/batch innen begrensninger"],
      affects: "Synlighet på publiserte sider",
      publishControl: "Knyttet til content — ikke egen menykilde",
      whyMatters: "SEO endrer metadata/innhold — må følge review for å unngå feil i produksjon.",
    },
  },
  {
    id: "social",
    title: "Social",
    description: "Ekstern publish begrenset — se modulstatus.",
    sourceOfTruth: "social engine + policy",
    cmsSurfaceHref: "/backoffice/social",
    mutationPosture: "review",
    postureLabel: "DRY_RUN / policy",
    actions: [
      { label: "Social (backoffice)", href: "/backoffice/social" },
      { label: "Superadmin — social engine", href: "/superadmin/growth/social" },
    ],
    actionRouting: {
      reads: ["Planlagt innhold, policyflagg"],
      writes: ["Ekstern publish ofte begrenset / dry_run"],
      affects: "Ekstern synlighet — ikke ordresannhet",
      publishControl: "Policy + nøkler — se superadmin engine",
      whyMatters: "Ekstern publish kan være dry_run — ikke markedsfør som garantert live.",
    },
  },
  {
    id: "esg",
    title: "ESG",
    description: "Aggregater; tom data er ikke suksess.",
    sourceOfTruth: "ESG API + aggregater",
    cmsSurfaceHref: "/backoffice/esg",
    mutationPosture: "read_only",
    postureLabel: "LIMITED",
    actions: [{ label: "ESG", href: "/backoffice/esg" }],
    actionRouting: {
      reads: ["Aggregerte miljø-/ESG-data"],
      writes: ["Ingen direkte write fra denne flaten"],
      affects: "Rapportering og innsikt — ikke ordre",
      publishControl: "Read-biased — review før tolkning",
      whyMatters: "Tomme aggregater skal ikke presenteres som full suksess.",
    },
  },
];

export function getDomainActionSurfaceById(id: string): ControlPlaneDomainActionSurface | undefined {
  return CONTROL_PLANE_DOMAIN_ACTION_SURFACES.find((x) => x.id === id);
}

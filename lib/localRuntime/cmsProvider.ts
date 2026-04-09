import {
  getNextState,
  type WorkflowAction,
  type WorkflowState,
} from "@/lib/backoffice/content/workflowRepo";
import { validateBodyPayloadBlockAllowlist } from "@/lib/cms/blockAllowlistGovernance";
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import {
  mergeAllBlockEditorDataTypesWithOverrides,
  parseOverridesFromSettingsRoot,
} from "@/lib/cms/blocks/blockEditorDataTypeMerge";
import {
  mergeAllCompositionsWithOverrides,
  parseCompositionOverridesFromSettingsRoot,
} from "@/lib/cms/schema/compositionDefinitionMerge";
import {
  mergeAllDocumentTypesWithOverrides,
  parseDocumentTypeOverridesFromSettingsRoot,
} from "@/lib/cms/schema/documentTypeDefinitionMerge";
import { expandDocumentTypeWithCompositions } from "@/lib/cms/schema/documentTypeCompositionExpand";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { parseBodyEnvelope, serializeBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import { mergeInvariantLayerIntoBody } from "@/lib/cms/variantInvariantPropagation";
import { CONTENT_AUDIT_ACTION_PUBLISH } from "@/lib/cms/contentAuditActions";
import {
  isContentTreeRootKey,
  type ContentTreeRootKey,
} from "@/lib/cms/contentTreeRoots";
import { buildMarketingHomeBody } from "@/lib/cms/seed/marketingHomeBody";
import { getCmsRuntimeStatus, isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";
import { SUPERADMIN_EMAIL, SUPPORT_EMAIL } from "@/lib/system/emails";

type GlobalContentKey = "header" | "footer" | "settings";
type LocalCmsEnvironment = "prod" | "preview" | "staging";
type LocalCmsLocale = "nb" | "en";
type LocalCmsStatus = "draft" | "published";

type HeaderNavItem = { label: string; href: string; exact?: boolean };

type LocalCmsPage = {
  id: string;
  title: string;
  slug: string;
  status: LocalCmsStatus;
  page_key: string | null;
  tree_parent_id: string | null;
  tree_root_key: ContentTreeRootKey | null;
  tree_sort_order: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

type LocalCmsVariant = {
  id: string;
  page_id: string;
  locale: LocalCmsLocale;
  environment: LocalCmsEnvironment;
  body: unknown;
  created_at: string;
  updated_at: string;
};

type LocalCmsAuditItem = {
  id: string;
  page_id: string | null;
  variant_id: string | null;
  environment: string | null;
  locale: string | null;
  action: string;
  actor_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type LocalCmsWorkflowItem = {
  id: string;
  page_id: string;
  variant_id: string;
  environment: "prod" | "staging";
  locale: LocalCmsLocale;
  state: WorkflowState;
  updated_at: string;
  updated_by: string | null;
  created_at: string;
};

type LocalCmsVersionSnapshot = {
  page: {
    id: string;
    title: string;
    slug: string;
    status: LocalCmsStatus;
    published_at: string | null;
  };
  variant: {
    id: string;
    locale: LocalCmsLocale;
    environment: LocalCmsEnvironment;
  };
  body: unknown;
  changedFields: string[];
};

type LocalCmsVersion = {
  id: string;
  page_id: string;
  locale: LocalCmsLocale;
  environment: LocalCmsEnvironment;
  version_number: number;
  created_at: string;
  created_by: string | null;
  label: string;
  action: string;
  data: LocalCmsVersionSnapshot;
};

type LocalCmsGlobalState = {
  draft: Record<string, unknown>;
  published: Record<string, unknown>;
  draftVersion: number;
  publishedVersion: number;
  updated_at: string;
};

type LocalCmsStore = {
  pages: LocalCmsPage[];
  variants: LocalCmsVariant[];
  versions: LocalCmsVersion[];
  audit: LocalCmsAuditItem[];
  workflows: LocalCmsWorkflowItem[];
  globals: Record<GlobalContentKey, LocalCmsGlobalState>;
  tick: number;
};

type LocalCmsPagePayload = {
  id: string;
  title: string;
  slug: string;
  status: LocalCmsStatus;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  body: unknown;
  variantId: string | null;
  tree_parent_id: string | null;
  tree_root_key: ContentTreeRootKey | null;
};

type LocalCmsPageDetailPayload = {
  id: string;
  title: string;
  slug: string;
  status: LocalCmsStatus;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  body: unknown;
  page: LocalCmsPagePayload;
  variant: {
    id: string | null;
    locale: string;
    environment: string;
  };
};

const LOCAL_RUNTIME_STORE_KEY = "__LP_LOCAL_CMS_RUNTIME_STORE__";
const LOCAL_RUNTIME_BASE_TS = Date.parse("2026-04-02T08:00:00.000Z");

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function randomUuid(): string {
  return globalThis.crypto.randomUUID();
}

function nowIso(store: LocalCmsStore): string {
  const iso = new Date(LOCAL_RUNTIME_BASE_TS + store.tick * 60_000).toISOString();
  store.tick += 1;
  return iso;
}

function variantKey(
  pageId: string,
  locale: string,
  environment: string,
): string {
  return `${pageId}:${locale}:${environment}`;
}

function workflowKey(variantId: string, environment: string, locale: string): string {
  return `${variantId}:${environment}:${locale}`;
}

function snapshotBodyEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function bodyEnvelopeForDocType(
  documentType: string,
  title: string,
  note: string,
  blocksBody: { version: number; blocks: unknown[] },
  extraFields?: Record<string, unknown>,
) {
  return serializeBodyEnvelope({
    documentType,
    fields: {
      title,
      note,
      ...(extraFields ?? {}),
    },
    blocksBody,
  });
}

function bodyEnvelopeFromBlocks(
  title: string,
  note: string,
  blocksBody: { version: number; blocks: unknown[] },
  extraFields?: Record<string, unknown>,
) {
  return bodyEnvelopeForDocType("page", title, note, blocksBody, extraFields);
}

function buildFaqBlocks(title: string, preview: boolean) {
  return {
    version: 1,
    blocks: [
      {
        id: "faq-hero",
        type: "hero",
        data: {
          title,
          subtitle: preview
            ? "Lokal runtime gir samme innholdsflate, men med en trygg og deterministisk editor-kjede."
            : "Vanlige spørsmål om bestilling, cutoff og hvordan dere kommer i gang.",
          ctaLabel: "Logg inn",
          ctaHref: "/login",
        },
      },
      {
        id: "faq-body",
        type: "richText",
        data: {
          heading: "Ofte stilte spørsmål",
          body:
            "<p><strong>Nar bestiller ansatte?</strong> Bestilling og endringer skjer frem til cutoff kl. 08:00 samme dag.</p>" +
            "<p><strong>Hvordan far admin kontroll?</strong> Admin ser status, publisering og historikk fra samme arbeidsflate.</p>" +
            "<p><strong>Hva skjer lokalt?</strong> Denne siden leveres fra lokal CMS-runtime uten ekstern DNS- eller auth-avhengighet.</p>",
        },
      },
      {
        id: "faq-cta",
        type: "cta",
        data: {
          title: preview ? "Klar for editor" : "Klar til a ga videre",
          body: preview
            ? "Aapne content-oversikten og fortsett i editoren uten overlays eller competing truth."
            : "Logg inn og fortsett til backoffice for a se hele arbeidsflaten.",
          buttonLabel: "Aapne content",
          buttonHref: "/backoffice/content",
        },
      },
    ],
  };
}

function buildWorkspaceBlocks(preview: boolean) {
  return {
    version: 1,
    blocks: [
      {
        id: "workspace-hero",
        type: "hero_full",
        data: {
          title: preview ? "Bellissima arbeidsflate i lokal preview" : "Bellissima arbeidsflate",
          subtitle:
            "Content, design, preview, historikk og handlinger henger sammen i samme kontekstmodell.",
          ctaLabel: "Aapne editor",
          ctaHref: "/backoffice/content",
          useGradient: true,
        },
      },
      {
        id: "workspace-copy",
        type: "richText",
        data: {
          heading: "En arbeidsflate",
          body:
            "<p>Denne demosiden er seedet for a verifisere at editoren har en tydelig sannhetskilde.</p>" +
            "<p>Preview-varianten er ulik publisert variant slik at diff, historikk og runtime-linkage kan testes lokalt.</p>",
        },
      },
      {
        id: "workspace-divider",
        type: "divider",
        data: {
          style: "space",
        },
      },
      {
        id: "workspace-cta",
        type: "cta",
        data: {
          title: "Fortsett i backoffice",
          body: "Ga til content-oversikten og aapne denne siden i editoren.",
          buttonLabel: "Ga til backoffice",
          buttonHref: "/backoffice/content",
        },
      },
    ],
  };
}

function buildHomeEnvelope(preview: boolean) {
  const marketing = cloneValue(buildMarketingHomeBody());
  const hero = marketing.blocks[0];
  if (hero && typeof hero === "object" && hero != null) {
    const nextHero = hero as { data?: Record<string, unknown> };
    const heroData = nextHero.data ?? {};
    nextHero.data = {
      ...heroData,
      title: preview
        ? "Firmalunsj med kontroll - lokal preview uten overlays."
        : "Firmalunsj med kontroll - uten unntak.",
      subtitle: preview
        ? "Denne preview-varianten er seedet for a vise publisering, diff og historikk i lokal runtime."
        : "En sannhetskilde for bestilling, produksjon og historikk. Mindre administrasjon, mindre matsvinn, bedre lunsj.",
      ctaLabel: preview ? "Aapne content-editor" : "Se meny",
      ctaHref: preview ? "/backoffice/content" : "/ukemeny",
    };
  }
  return bodyEnvelopeFromBlocks(
    "Forside",
    preview ? "Preview-seed for editor og publisering." : "Publisert seed for forside.",
    marketing,
    { localRuntime: true, previewSeed: preview },
  );
}

/** U94 — `compact_page` + `compact_page_blocks` (smalt allowlist-bevis). */
function buildCompactPageEnvelope(preview: boolean) {
  const blocksBody = {
    version: 1,
    blocks: [
      {
        id: "compact-hero",
        type: "hero",
        data: {
          title: preview ? "Kompakt side (preview)" : "Kompakt side",
          subtitle: "Data type compact_page_blocks — pricing og flere typer er ikke tilgjengelige her.",
          ctaLabel: "Les mer",
          ctaHref: "/",
        },
      },
    ],
  };
  return bodyEnvelopeForDocType(
    "compact_page",
    "Kompakt demo",
    preview ? "Preview for U94 data type-bevis." : "Publisert kompakt demo.",
    blocksBody,
    { localRuntime: true, previewSeed: preview, u94DataTypeProof: true },
  );
}

/** U94 — `micro_landing` + `page_micro_blocks` (maks 3 blokker). */
function buildMicroLandingEnvelope(preview: boolean) {
  const blocksBody = {
    version: 1,
    blocks: [
      {
        id: "micro-h1",
        type: "hero",
        data: {
          title: preview ? "Micro (preview)" : "Micro landing",
          subtitle: "Tre blokker — legg til er blokkert ved tak.",
          ctaLabel: "OK",
          ctaHref: "/",
        },
      },
      {
        id: "micro-rt",
        type: "richText",
        data: {
          heading: "Brødtekst",
          body: "<p>Tekst</p>",
        },
      },
      {
        id: "micro-cta",
        type: "cta",
        data: {
          title: "CTA",
          body: "",
          buttonLabel: "Klikk",
          buttonHref: "/",
        },
      },
    ],
  };
  return bodyEnvelopeForDocType(
    "micro_landing",
    "Micro cap",
    preview ? "Preview micro landing." : "Publisert micro landing.",
    blocksBody,
    { localRuntime: true, previewSeed: preview, u94DataTypeProof: true },
  );
}

function buildFaqEnvelope(preview: boolean) {
  const title = "Bestilling og spørsmål";
  return bodyEnvelopeFromBlocks(
    title,
    preview ? "Preview-variant for lokal FAQ-side." : "Publisert FAQ-side for lokal runtime.",
    buildFaqBlocks(title, preview),
    { localRuntime: true, previewSeed: preview },
  );
}

function buildWorkspaceEnvelope(preview: boolean) {
  const title = "Bellissima arbeidsflate";
  return bodyEnvelopeFromBlocks(
    title,
    preview ? "Preview-variant for Bellissima arbeidsflate." : "Publisert Bellissima demoside.",
    buildWorkspaceBlocks(preview),
    { localRuntime: true, previewSeed: preview },
  );
}

function defaultHeaderDocument() {
  const publicNav: HeaderNavItem[] = [
    { label: "Hjem", href: "/" },
    { label: "Bestilling og spørsmål", href: "/bestilling-og-sporsmal" },
    { label: "Alternativ til kantine", href: "/alternativ-til-kantine" },
    { label: "Logg inn", href: "/login" },
  ];
  return {
    title: "Lunchportalen",
    areaLabel: "Hovedmeny",
    logo: "/brand/LP-logo-uten-bakgrunn.png",
    navigation: publicNav,
    headerNavByVariant: {
      public: {
        title: "Lunchportalen",
        nav: publicNav,
      },
      superadmin: {
        title: "Backoffice",
        nav: [
          { label: "Content", href: "/backoffice/content" },
          { label: "AI", href: "/backoffice/ai" },
          { label: "Til forsiden", href: "/" },
        ],
      },
      employee: {
        title: "Ansatt",
        nav: [
          { label: "Week", href: "/week" },
          { label: "Til forsiden", href: "/" },
        ],
      },
    },
  };
}

function defaultFooterDocument() {
  return {
    links: [
      { label: "Bestilling og spørsmål", href: "/bestilling-og-sporsmal" },
      { label: "Alternativ til kantine", href: "/alternativ-til-kantine" },
      { label: "Logg inn", href: "/login" },
    ],
    columns: [
      {
        head: "Produkt",
        links: [
          { label: "Backoffice", href: "/backoffice/content" },
          { label: "Preview", href: "/?preview=true" },
        ],
      },
      {
        head: "Kontakt",
        links: [
          { label: "Kontakt oss", href: "/kontakt" },
          { label: "Support", href: `mailto:${SUPPORT_EMAIL}` },
        ],
      },
    ],
    bottomText: "Lokal CMS-runtime for development. Produksjonsbanen er urort.",
  };
}

function defaultSettingsDocument() {
  return {
    designSettings: {
      layout: {
        container: "wide",
      },
    },
    previewDefaults: {
      locale: "nb",
      environment: "preview",
    },
    localRuntime: true,
  };
}

function pageSnapshot(page: LocalCmsPage, variant: LocalCmsVariant, changedFields: string[]) {
  return {
    page: {
      id: page.id,
      title: page.title,
      slug: page.slug,
      status: page.status,
      published_at: page.published_at,
    },
    variant: {
      id: variant.id,
      locale: variant.locale,
      environment: variant.environment,
    },
    body: cloneValue(variant.body),
    changedFields: [...changedFields],
  } satisfies LocalCmsVersionSnapshot;
}

export function getCanonicalCmsSeedDataset(): {
  pages: LocalCmsPage[];
  variants: LocalCmsVariant[];
} {
  const pages: LocalCmsPage[] = [
    {
      id: "00000000-0000-4000-8000-00000000c001",
      title: "Forside",
      slug: "home",
      status: "published",
      page_key: "home",
      tree_parent_id: null,
      tree_root_key: "home",
      tree_sort_order: 0,
      created_at: "2026-04-01T08:00:00.000Z",
      updated_at: "2026-04-02T08:15:00.000Z",
      published_at: "2026-04-01T08:00:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-00000000c002",
      title: "Bestilling og spørsmål",
      slug: "bestilling-og-sporsmal",
      status: "published",
      page_key: null,
      tree_parent_id: null,
      tree_root_key: "overlays",
      tree_sort_order: 0,
      created_at: "2026-04-01T08:20:00.000Z",
      updated_at: "2026-04-02T08:20:00.000Z",
      published_at: "2026-04-01T08:20:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-00000000c003",
      title: "Bellissima arbeidsflate",
      slug: "bellissima-arbeidsflate",
      status: "published",
      page_key: null,
      tree_parent_id: null,
      tree_root_key: "overlays",
      tree_sort_order: 1,
      created_at: "2026-04-01T08:40:00.000Z",
      updated_at: "2026-04-02T08:25:00.000Z",
      published_at: "2026-04-01T08:40:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-00000000c004",
      title: "U94 Kompakt (data type)",
      slug: "u94-compact",
      status: "published",
      page_key: null,
      tree_parent_id: null,
      tree_root_key: "overlays",
      tree_sort_order: 2,
      created_at: "2026-04-01T09:00:00.000Z",
      updated_at: "2026-04-02T09:00:00.000Z",
      published_at: "2026-04-01T09:00:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-00000000c005",
      title: "U94 Micro cap",
      slug: "u94-micro",
      status: "published",
      page_key: null,
      tree_parent_id: null,
      tree_root_key: "overlays",
      tree_sort_order: 3,
      created_at: "2026-04-01T09:10:00.000Z",
      updated_at: "2026-04-02T09:10:00.000Z",
      published_at: "2026-04-01T09:10:00.000Z",
    },
  ];

  const variants: LocalCmsVariant[] = [
    {
      id: "00000000-0000-4000-8100-00000000d101",
      page_id: pages[0]!.id,
      locale: "nb",
      environment: "prod",
      body: buildHomeEnvelope(false),
      created_at: "2026-04-01T08:00:00.000Z",
      updated_at: "2026-04-01T08:00:00.000Z",
    },
    {
      id: "00000000-0000-4000-8100-00000000d102",
      page_id: pages[0]!.id,
      locale: "nb",
      environment: "preview",
      body: buildHomeEnvelope(true),
      created_at: "2026-04-01T08:05:00.000Z",
      updated_at: "2026-04-02T08:15:00.000Z",
    },
    {
      id: "00000000-0000-4000-8100-00000000d201",
      page_id: pages[1]!.id,
      locale: "nb",
      environment: "prod",
      body: buildFaqEnvelope(false),
      created_at: "2026-04-01T08:20:00.000Z",
      updated_at: "2026-04-01T08:20:00.000Z",
    },
    {
      id: "00000000-0000-4000-8100-00000000d202",
      page_id: pages[1]!.id,
      locale: "nb",
      environment: "preview",
      body: buildFaqEnvelope(true),
      created_at: "2026-04-01T08:22:00.000Z",
      updated_at: "2026-04-02T08:20:00.000Z",
    },
    {
      id: "00000000-0000-4000-8100-00000000d301",
      page_id: pages[2]!.id,
      locale: "nb",
      environment: "prod",
      body: buildWorkspaceEnvelope(false),
      created_at: "2026-04-01T08:40:00.000Z",
      updated_at: "2026-04-01T08:40:00.000Z",
    },
    {
      id: "00000000-0000-4000-8100-00000000d302",
      page_id: pages[2]!.id,
      locale: "nb",
      environment: "preview",
      body: buildWorkspaceEnvelope(true),
      created_at: "2026-04-01T08:42:00.000Z",
      updated_at: "2026-04-02T08:25:00.000Z",
    },
    {
      id: "00000000-0000-4000-8100-00000000d401",
      page_id: pages[3]!.id,
      locale: "nb",
      environment: "prod",
      body: buildCompactPageEnvelope(false),
      created_at: "2026-04-01T09:00:00.000Z",
      updated_at: "2026-04-01T09:00:00.000Z",
    },
    {
      id: "00000000-0000-4000-8100-00000000d402",
      page_id: pages[3]!.id,
      locale: "nb",
      environment: "preview",
      body: buildCompactPageEnvelope(true),
      created_at: "2026-04-01T09:01:00.000Z",
      updated_at: "2026-04-02T09:00:00.000Z",
    },
    {
      id: "00000000-0000-4000-8100-00000000d501",
      page_id: pages[4]!.id,
      locale: "nb",
      environment: "prod",
      body: buildMicroLandingEnvelope(false),
      created_at: "2026-04-01T09:10:00.000Z",
      updated_at: "2026-04-01T09:10:00.000Z",
    },
    {
      id: "00000000-0000-4000-8100-00000000d502",
      page_id: pages[4]!.id,
      locale: "nb",
      environment: "preview",
      body: buildMicroLandingEnvelope(true),
      created_at: "2026-04-01T09:11:00.000Z",
      updated_at: "2026-04-02T09:10:00.000Z",
    },
  ];

  return {
    pages,
    variants,
  };
}

function createSeedStore(): LocalCmsStore {
  const { pages, variants } = getCanonicalCmsSeedDataset();

  const homeProd = variants[0]!;
  const homePreview = variants[1]!;
  const faqProd = variants[2]!;
  const faqPreview = variants[3]!;
  const workspaceProd = variants[4]!;
  const workspacePreview = variants[5]!;
  const compactProd = variants[6]!;
  const compactPreview = variants[7]!;
  const microProd = variants[8]!;
  const microPreview = variants[9]!;

  const versions: LocalCmsVersion[] = [
    {
      id: "00000000-0000-4000-8200-00000000e101",
      page_id: pages[0]!.id,
      locale: "nb",
      environment: "prod",
      version_number: 1,
      created_at: "2026-04-01T08:00:00.000Z",
      created_by: "00000000-0000-4000-8000-000000000043",
      label: "Publisert forside",
      action: "publish",
      data: pageSnapshot(pages[0]!, homeProd, ["Innhold"]),
    },
    {
      id: "00000000-0000-4000-8200-00000000e102",
      page_id: pages[0]!.id,
      locale: "nb",
      environment: "preview",
      version_number: 1,
      created_at: "2026-04-02T08:15:00.000Z",
      created_by: "00000000-0000-4000-8000-000000000043",
      label: "Lokal editorlagring",
      action: "save",
      data: pageSnapshot(pages[0]!, homePreview, ["Innhold", "CTA"]),
    },
    {
      id: "00000000-0000-4000-8200-00000000e201",
      page_id: pages[1]!.id,
      locale: "nb",
      environment: "prod",
      version_number: 1,
      created_at: "2026-04-01T08:20:00.000Z",
      created_by: "00000000-0000-4000-8000-000000000043",
      label: "Publisert FAQ",
      action: "publish",
      data: pageSnapshot(pages[1]!, faqProd, ["Innhold"]),
    },
    {
      id: "00000000-0000-4000-8200-00000000e202",
      page_id: pages[1]!.id,
      locale: "nb",
      environment: "preview",
      version_number: 1,
      created_at: "2026-04-02T08:20:00.000Z",
      created_by: "00000000-0000-4000-8000-000000000043",
      label: "Preview justering",
      action: "save",
      data: pageSnapshot(pages[1]!, faqPreview, ["Innhold"]),
    },
    {
      id: "00000000-0000-4000-8200-00000000e301",
      page_id: pages[2]!.id,
      locale: "nb",
      environment: "prod",
      version_number: 1,
      created_at: "2026-04-01T08:40:00.000Z",
      created_by: "00000000-0000-4000-8000-000000000043",
      label: "Publisert Bellissima-demo",
      action: "publish",
      data: pageSnapshot(pages[2]!, workspaceProd, ["Innhold"]),
    },
    {
      id: "00000000-0000-4000-8200-00000000e302",
      page_id: pages[2]!.id,
      locale: "nb",
      environment: "preview",
      version_number: 1,
      created_at: "2026-04-02T08:25:00.000Z",
      created_by: "00000000-0000-4000-8000-000000000043",
      label: "Workspace preview",
      action: "save",
      data: pageSnapshot(pages[2]!, workspacePreview, ["Innhold"]),
    },
    {
      id: "00000000-0000-4000-8200-00000000e401",
      page_id: pages[3]!.id,
      locale: "nb",
      environment: "prod",
      version_number: 1,
      created_at: "2026-04-01T09:00:00.000Z",
      created_by: "00000000-0000-4000-8000-000000000043",
      label: "U94 kompakt publisert",
      action: "publish",
      data: pageSnapshot(pages[3]!, compactProd, ["Innhold"]),
    },
    {
      id: "00000000-0000-4000-8200-00000000e402",
      page_id: pages[3]!.id,
      locale: "nb",
      environment: "preview",
      version_number: 1,
      created_at: "2026-04-02T09:00:00.000Z",
      created_by: "00000000-0000-4000-8000-000000000043",
      label: "U94 kompakt preview",
      action: "save",
      data: pageSnapshot(pages[3]!, compactPreview, ["Innhold"]),
    },
    {
      id: "00000000-0000-4000-8200-00000000e501",
      page_id: pages[4]!.id,
      locale: "nb",
      environment: "prod",
      version_number: 1,
      created_at: "2026-04-01T09:10:00.000Z",
      created_by: "00000000-0000-4000-8000-000000000043",
      label: "U94 micro publisert",
      action: "publish",
      data: pageSnapshot(pages[4]!, microProd, ["Innhold"]),
    },
    {
      id: "00000000-0000-4000-8200-00000000e502",
      page_id: pages[4]!.id,
      locale: "nb",
      environment: "preview",
      version_number: 1,
      created_at: "2026-04-02T09:10:00.000Z",
      created_by: "00000000-0000-4000-8000-000000000043",
      label: "U94 micro preview",
      action: "save",
      data: pageSnapshot(pages[4]!, microPreview, ["Innhold"]),
    },
  ];

  const audit: LocalCmsAuditItem[] = [
    {
      id: "00000000-0000-4000-8300-00000000f101",
      page_id: pages[0]!.id,
      variant_id: homeProd.id,
      environment: "prod",
      locale: "nb",
      action: CONTENT_AUDIT_ACTION_PUBLISH,
      actor_email: SUPERADMIN_EMAIL,
      metadata: { source: "local_seed" },
      created_at: "2026-04-01T08:00:00.000Z",
    },
    {
      id: "00000000-0000-4000-8300-00000000f102",
      page_id: pages[0]!.id,
      variant_id: homePreview.id,
      environment: "preview",
      locale: "nb",
      action: "save",
      actor_email: SUPERADMIN_EMAIL,
      metadata: { source: "local_seed", view: "content" },
      created_at: "2026-04-02T08:15:00.000Z",
    },
    {
      id: "00000000-0000-4000-8300-00000000f201",
      page_id: pages[1]!.id,
      variant_id: faqPreview.id,
      environment: "preview",
      locale: "nb",
      action: "save",
      actor_email: SUPERADMIN_EMAIL,
      metadata: { source: "local_seed", view: "history" },
      created_at: "2026-04-02T08:20:00.000Z",
    },
  ];

  const workflows: LocalCmsWorkflowItem[] = [
    {
      id: "00000000-0000-4000-8400-00000000a101",
      page_id: pages[0]!.id,
      variant_id: homePreview.id,
      environment: "prod",
      locale: "nb",
      state: "approved",
      updated_at: "2026-04-02T08:16:00.000Z",
      updated_by: SUPERADMIN_EMAIL,
      created_at: "2026-04-02T08:16:00.000Z",
    },
    {
      id: "00000000-0000-4000-8400-00000000a102",
      page_id: pages[0]!.id,
      variant_id: homePreview.id,
      environment: "staging",
      locale: "nb",
      state: "approved",
      updated_at: "2026-04-02T08:16:00.000Z",
      updated_by: SUPERADMIN_EMAIL,
      created_at: "2026-04-02T08:16:00.000Z",
    },
    {
      id: "00000000-0000-4000-8400-00000000a201",
      page_id: pages[1]!.id,
      variant_id: faqPreview.id,
      environment: "prod",
      locale: "nb",
      state: "approved",
      updated_at: "2026-04-02T08:21:00.000Z",
      updated_by: SUPERADMIN_EMAIL,
      created_at: "2026-04-02T08:21:00.000Z",
    },
    {
      id: "00000000-0000-4000-8400-00000000a202",
      page_id: pages[1]!.id,
      variant_id: faqPreview.id,
      environment: "staging",
      locale: "nb",
      state: "approved",
      updated_at: "2026-04-02T08:21:00.000Z",
      updated_by: SUPERADMIN_EMAIL,
      created_at: "2026-04-02T08:21:00.000Z",
    },
    {
      id: "00000000-0000-4000-8400-00000000a301",
      page_id: pages[2]!.id,
      variant_id: workspacePreview.id,
      environment: "prod",
      locale: "nb",
      state: "approved",
      updated_at: "2026-04-02T08:26:00.000Z",
      updated_by: SUPERADMIN_EMAIL,
      created_at: "2026-04-02T08:26:00.000Z",
    },
    {
      id: "00000000-0000-4000-8400-00000000a302",
      page_id: pages[2]!.id,
      variant_id: workspacePreview.id,
      environment: "staging",
      locale: "nb",
      state: "approved",
      updated_at: "2026-04-02T08:26:00.000Z",
      updated_by: SUPERADMIN_EMAIL,
      created_at: "2026-04-02T08:26:00.000Z",
    },
  ];

  const globals: Record<GlobalContentKey, LocalCmsGlobalState> = {
    header: {
      draft: defaultHeaderDocument(),
      published: defaultHeaderDocument(),
      draftVersion: 1,
      publishedVersion: 1,
      updated_at: "2026-04-02T08:05:00.000Z",
    },
    footer: {
      draft: defaultFooterDocument(),
      published: defaultFooterDocument(),
      draftVersion: 1,
      publishedVersion: 1,
      updated_at: "2026-04-02T08:05:00.000Z",
    },
    settings: {
      draft: defaultSettingsDocument(),
      published: defaultSettingsDocument(),
      draftVersion: 1,
      publishedVersion: 1,
      updated_at: "2026-04-02T08:05:00.000Z",
    },
  };

  return {
    pages,
    variants,
    versions,
    audit,
    workflows,
    globals,
    tick: 40,
  };
}

function getStore(): LocalCmsStore {
  const bag = globalThis as typeof globalThis & {
    [LOCAL_RUNTIME_STORE_KEY]?: LocalCmsStore;
  };
  if (!bag[LOCAL_RUNTIME_STORE_KEY]) {
    bag[LOCAL_RUNTIME_STORE_KEY] = createSeedStore();
  }
  return bag[LOCAL_RUNTIME_STORE_KEY]!;
}

function findPage(store: LocalCmsStore, pageId: string): LocalCmsPage | null {
  return store.pages.find((page) => page.id === pageId) ?? null;
}

function findPageBySlug(store: LocalCmsStore, slug: string): LocalCmsPage | null {
  const normalized = normalizeSlug(slug);
  return store.pages.find((page) => page.slug === normalized) ?? null;
}

function findVariant(
  store: LocalCmsStore,
  pageId: string,
  locale: string,
  environment: string,
): LocalCmsVariant | null {
  return (
    store.variants.find(
      (variant) =>
        variant.page_id === pageId &&
        variant.locale === locale &&
        variant.environment === environment,
    ) ?? null
  );
}

function ensureVariant(
  store: LocalCmsStore,
  page: LocalCmsPage,
  locale: LocalCmsLocale,
  environment: LocalCmsEnvironment,
): LocalCmsVariant {
  const existing = findVariant(store, page.id, locale, environment);
  if (existing) return existing;
  const timestamp = nowIso(store);
  const variant: LocalCmsVariant = {
    id: randomUuid(),
    page_id: page.id,
    locale,
    environment,
    body: bodyEnvelopeFromBlocks(page.title, "Ny lokal side.", { version: 1, blocks: [] }),
    created_at: timestamp,
    updated_at: timestamp,
  };
  store.variants.push(variant);
  return variant;
}

function resolveVariantForRead(
  store: LocalCmsStore,
  pageId: string,
  locale: string,
  environment: string,
): LocalCmsVariant | null {
  return findVariant(store, pageId, locale, environment);
}

function buildPagePayload(page: LocalCmsPage, variant: LocalCmsVariant | null): LocalCmsPagePayload {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    status: page.status,
    created_at: page.created_at ?? null,
    updated_at: page.updated_at ?? page.created_at ?? null,
    published_at: page.published_at ?? null,
    body: cloneValue(variant?.body ?? { version: 1, blocks: [] }),
    variantId: variant?.id ?? null,
    tree_parent_id: page.tree_parent_id,
    tree_root_key: page.tree_root_key,
  };
}

function buildPageDetailPayload(
  page: LocalCmsPage,
  variant: LocalCmsVariant | null,
  locale: string,
  environment: string,
): LocalCmsPageDetailPayload {
  const pagePayload = buildPagePayload(page, variant);
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    status: page.status,
    created_at: page.created_at ?? null,
    updated_at: page.updated_at ?? page.created_at ?? null,
    published_at: page.published_at ?? null,
    body: cloneValue(variant?.body ?? { version: 1, blocks: [] }),
    page: pagePayload,
    variant: {
      id: variant?.id ?? null,
      locale,
      environment,
    },
  };
}

function changedFieldsFromInput(params: {
  titleDefined: boolean;
  slugDefined: boolean;
  statusDefined: boolean;
  bodyDefined: boolean;
  resolvedBodyPayload: unknown;
}): string[] {
  const fields: string[] = [];
  if (params.titleDefined) fields.push("Tittel");
  if (params.slugDefined) fields.push("Slug");
  if (params.statusDefined) fields.push("Status");
  if (params.bodyDefined) {
    fields.push("Innhold");
    const bodyText = JSON.stringify(params.resolvedBodyPayload ?? {});
    if (bodyText.toLowerCase().includes("cta") && !fields.includes("CTA")) {
      fields.push("CTA");
    }
  }
  return fields;
}

function latestVersionNumber(
  store: LocalCmsStore,
  pageId: string,
  locale: string,
  environment: string,
): number {
  return store.versions
    .filter(
      (version) =>
        version.page_id === pageId &&
        version.locale === locale &&
        version.environment === environment,
    )
    .reduce((max, version) => Math.max(max, version.version_number), 0);
}

function recordVersion(
  store: LocalCmsStore,
  page: LocalCmsPage,
  variant: LocalCmsVariant,
  params: {
    createdBy?: string | null;
    label: string;
    action: string;
    changedFields: string[];
    createdAt?: string;
  },
): LocalCmsVersion {
  const version: LocalCmsVersion = {
    id: randomUuid(),
    page_id: page.id,
    locale: variant.locale,
    environment: variant.environment,
    version_number:
      latestVersionNumber(store, page.id, variant.locale, variant.environment) + 1,
    created_at: params.createdAt ?? nowIso(store),
    created_by: params.createdBy ?? null,
    label: params.label,
    action: params.action,
    data: pageSnapshot(page, variant, params.changedFields),
  };
  store.versions.push(version);
  return version;
}

function addAudit(
  store: LocalCmsStore,
  params: Omit<LocalCmsAuditItem, "id" | "created_at"> & { created_at?: string },
) {
  store.audit.unshift({
    id: randomUuid(),
    created_at: params.created_at ?? nowIso(store),
    page_id: params.page_id,
    variant_id: params.variant_id,
    environment: params.environment,
    locale: params.locale,
    action: params.action,
    actor_email: params.actor_email,
    metadata: cloneValue(params.metadata),
  });
}

function readGlobalVariantBlock(
  data: Record<string, unknown>,
  variant: string,
): { title: string; nav: HeaderNavItem[] } | null {
  const byVariant =
    data.headerNavByVariant &&
    typeof data.headerNavByVariant === "object" &&
    !Array.isArray(data.headerNavByVariant)
      ? (data.headerNavByVariant as Record<string, unknown>)
      : null;
  const rawBlock = byVariant?.[variant];
  if (!rawBlock || typeof rawBlock !== "object" || Array.isArray(rawBlock)) {
    return null;
  }
  const block = rawBlock as Record<string, unknown>;
  const nav = Array.isArray(block.nav)
    ? block.nav
        .filter((item) => item && typeof item === "object" && !Array.isArray(item))
        .map((item) => {
          const row = item as Record<string, unknown>;
          return {
            label: safeStr(row.label),
            href: safeStr(row.href),
            ...(row.exact === true ? { exact: true } : {}),
          };
        })
        .filter((item) => item.label && item.href)
    : [];
  return {
    title: safeStr(block.title),
    nav,
  };
}

function assertLocalRuntimeEnabled() {
  if (!isLocalCmsRuntimeEnabled()) {
    throw new LocalCmsRuntimeError("Lokal CMS-runtime er ikke aktiv.", 503, "LOCAL_RUNTIME_DISABLED");
  }
}

function assertReadableLocalCmsState() {
  const runtime = getCmsRuntimeStatus();
  if (runtime.mode === "local_provider" || runtime.mode === "reserve") return;
  throw new LocalCmsRuntimeError("Lokal CMS-runtime er ikke aktiv.", 503, "LOCAL_RUNTIME_DISABLED");
}

export class LocalCmsRuntimeError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(message: string, status = 500, code = "LOCAL_RUNTIME_ERROR", detail?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export function isLocalCmsRuntimeError(error: unknown): error is LocalCmsRuntimeError {
  return error instanceof LocalCmsRuntimeError;
}

export function resetLocalCmsRuntimeStoreForTests(): void {
  const bag = globalThis as typeof globalThis & {
    [LOCAL_RUNTIME_STORE_KEY]?: LocalCmsStore;
  };
  delete bag[LOCAL_RUNTIME_STORE_KEY];
}

export function listLocalCmsPages(params?: { q?: string | null; limit?: number }) {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const query = safeStr(params?.q).toLowerCase();
  const limit =
    typeof params?.limit === "number" && Number.isFinite(params.limit)
      ? Math.max(1, Math.min(params.limit, 200))
      : 50;
  return store.pages
    .filter((page) => {
      if (!query) return true;
      return `${page.title} ${page.slug}`.toLowerCase().includes(query);
    })
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))
    .slice(0, limit)
    .map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      status: page.status,
      updated_at: page.updated_at,
    }));
}

export function listLocalCmsTreePages(): LocalCmsPage[] {
  assertLocalRuntimeEnabled();
  const store = getStore();
  return store.pages
    .slice()
    .sort(
      (left, right) =>
        left.tree_sort_order - right.tree_sort_order ||
        left.slug.localeCompare(right.slug),
    )
    .map((page) => ({ ...page }));
}

export function moveLocalCmsTreeNode(params: {
  pageId: string;
  parentPageId?: string | null;
  rootKey?: string | null;
  sortOrder?: number;
}) {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const page = findPage(store, safeStr(params.pageId));
  if (!page) {
    throw new LocalCmsRuntimeError("Siden finnes ikke.", 404, "NOT_FOUND");
  }

  const parentPageId = safeStr(params.parentPageId) || null;
  const rootKeyRaw = safeStr(params.rootKey) || null;
  const mustUseRoot = parentPageId == null;
  const mustUseParent = parentPageId != null;

  if (mustUseRoot && !rootKeyRaw) {
    throw new LocalCmsRuntimeError(
      "Når parent_page_id er null må root_key angis (home, overlays, global, design).",
      400,
      "BAD_REQUEST",
    );
  }
  if (mustUseParent && rootKeyRaw) {
    throw new LocalCmsRuntimeError(
      "Når parent_page_id er satt skal root_key ikke angis.",
      400,
      "BAD_REQUEST",
    );
  }
  if (mustUseRoot && !isContentTreeRootKey(rootKeyRaw)) {
    throw new LocalCmsRuntimeError("Ugyldig root_key.", 400, "BAD_REQUEST");
  }

  if (mustUseParent && parentPageId === page.id) {
    throw new LocalCmsRuntimeError(
      "Kan ikke sette node som sin egen forelder.",
      400,
      "CYCLE_FORBIDDEN",
    );
  }

  if (mustUseParent && parentPageId) {
    let current: string | null = parentPageId;
    const visited = new Set<string>();
    let safety = 0;
    while (current && safety < 64) {
      if (current === page.id) {
        throw new LocalCmsRuntimeError(
          "Bevegelse ville skape syklus i treet.",
          400,
          "CYCLE_FORBIDDEN",
        );
      }
      if (visited.has(current)) {
        throw new LocalCmsRuntimeError(
          "Oppdaget syklisk struktur i treet.",
          400,
          "CYCLE_FORBIDDEN",
        );
      }
      visited.add(current);
      safety += 1;
      const currentPage = findPage(store, current);
      if (!currentPage) {
        throw new LocalCmsRuntimeError("Forelder finnes ikke.", 400, "INVALID_PARENT");
      }
      current = currentPage.tree_parent_id;
    }
    if (safety >= 64) {
      throw new LocalCmsRuntimeError(
        "Tre-dybde overstiger sikkerhetsgrense.",
        400,
        "INVALID_PARENT",
      );
    }
  }

  const timestamp = nowIso(store);
  page.tree_parent_id = mustUseParent ? parentPageId : null;
  page.tree_root_key = mustUseParent ? null : (rootKeyRaw as ContentTreeRootKey);
  page.tree_sort_order =
    typeof params.sortOrder === "number" && Number.isFinite(params.sortOrder)
      ? params.sortOrder
      : 0;
  page.updated_at = timestamp;

  return {
    id: page.id,
    tree_parent_id: page.tree_parent_id,
    tree_root_key: page.tree_root_key,
    tree_sort_order: page.tree_sort_order,
  };
}

export function getLocalCmsPageDetail(params: {
  pageId: string;
  locale?: string | null;
  environment?: string | null;
}): LocalCmsPageDetailPayload {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const page = findPage(store, params.pageId);
  if (!page) {
    throw new LocalCmsRuntimeError("Side ikke funnet.", 404, "NOT_FOUND");
  }
  const locale = (safeStr(params.locale) || "nb") as LocalCmsLocale;
  const environment = (safeStr(params.environment) || "prod") as LocalCmsEnvironment;
  let variant = resolveVariantForRead(store, page.id, locale, environment);
  if (!variant && locale === "en") {
    const nbVar = findVariant(store, page.id, "nb", environment);
    if (nbVar) {
      const e = parseBodyEnvelope(nbVar.body);
      const seeded = serializeBodyEnvelope({
        documentType: e.documentType,
        invariantFields: { ...e.invariantFields },
        cultureFields: {},
        blocksBody: e.blocksBody,
      });
      const timestamp = nowIso(store);
      const twin: LocalCmsVariant = {
        id: randomUuid(),
        page_id: page.id,
        locale: "en",
        environment,
        body: cloneValue(seeded),
        created_at: timestamp,
        updated_at: timestamp,
      };
      store.variants.push(twin);
      variant = twin;
    }
  }
  if (!variant) {
    throw new LocalCmsRuntimeError("Forespurt variant finnes ikke.", 404, "VARIANT_NOT_FOUND", {
      pageId: page.id,
      locale,
      environment,
    });
  }
  return buildPageDetailPayload(page, variant, locale, environment);
}

export function ensureLocalCmsHomePage() {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const page =
    store.pages.find((entry) => entry.slug === "home") ??
    (() => {
      const timestamp = nowIso(store);
      const created: LocalCmsPage = {
        id: randomUuid(),
        title: "Forside",
        slug: "home",
        status: "draft",
        page_key: "home",
        tree_parent_id: null,
        tree_root_key: "home",
        tree_sort_order: 0,
        created_at: timestamp,
        updated_at: timestamp,
        published_at: null,
      };
      store.pages.push(created);
      ensureVariant(store, created, "nb", "preview");
      return created;
    })();
  return {
    page: {
      id: page.id,
      title: page.title,
      slug: page.slug,
      status: page.status,
      updated_at: page.updated_at,
    },
  };
}

export function createLocalCmsPage(input: {
  title?: string;
  slug?: string;
  locale?: string | null;
  environment?: string | null;
  tree_parent_id?: string | null;
  tree_root_key?: string | null;
  body?: unknown;
  actorUserId?: string | null;
  actorEmail?: string | null;
}) {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const title = safeStr(input.title) || "Ny side";
  const slugCandidate = normalizeSlug(safeStr(input.slug) || title) || "ny-side";
  if (store.pages.some((page) => page.slug === slugCandidate)) {
    throw new LocalCmsRuntimeError("Slug already exists", 409, "SLUG_TAKEN");
  }
  const locale = (safeStr(input.locale) || "nb") as LocalCmsLocale;
  const environment = (safeStr(input.environment) || "prod") as LocalCmsEnvironment;
  const treeParentId = safeStr(input.tree_parent_id) || null;
  const rootRaw = safeStr(input.tree_root_key);
  const treeRootKey =
    !treeParentId && rootRaw && isContentTreeRootKey(rootRaw)
      ? (rootRaw as ContentTreeRootKey)
      : treeParentId
        ? null
        : ("overlays" as const);
  const timestamp = nowIso(store);
  const sortOrder = store.pages
    .filter(
      (page) =>
        page.tree_parent_id === treeParentId &&
        page.tree_root_key === treeRootKey,
    )
    .reduce((max, page) => Math.max(max, page.tree_sort_order), -1) + 1;
  const page: LocalCmsPage = {
    id: randomUuid(),
    title,
    slug: slugCandidate,
    status: "draft",
    page_key: null,
    tree_parent_id: treeParentId,
    tree_root_key: treeRootKey,
    tree_sort_order: sortOrder,
    created_at: timestamp,
    updated_at: timestamp,
    published_at: null,
  };
  store.pages.unshift(page);
  const variant: LocalCmsVariant = {
    id: randomUuid(),
    page_id: page.id,
    locale,
    environment,
    body:
      input.body ??
      bodyEnvelopeFromBlocks(title, "Ny lokal CMS-side.", {
        version: 1,
        blocks: [],
      }),
    created_at: timestamp,
    updated_at: timestamp,
  };
  store.variants.push(variant);
  const twinLocale: LocalCmsLocale = locale === "en" ? "nb" : "en";
  if (!findVariant(store, page.id, twinLocale, environment)) {
    const twinBody = cloneValue(variant.body);
    const twin: LocalCmsVariant = {
      id: randomUuid(),
      page_id: page.id,
      locale: twinLocale,
      environment,
      body: twinBody,
      created_at: timestamp,
      updated_at: timestamp,
    };
    store.variants.push(twin);
  }
  recordVersion(store, page, variant, {
    createdBy: input.actorUserId ?? null,
    label: "Opprettet lokalt",
    action: "create",
    changedFields: ["Tittel", "Slug", "Innhold"],
    createdAt: timestamp,
  });
  addAudit(store, {
    page_id: page.id,
    variant_id: variant.id,
    environment,
    locale,
    action: "create",
    actor_email: input.actorEmail ?? null,
    metadata: { source: "local_runtime" },
    created_at: timestamp,
  });
  return {
    page: buildPagePayload(page, variant),
  };
}

function getExpandedDocumentTypesForLocalCmsStore(store: LocalCmsStore): Record<string, DocumentTypeDefinition> {
  const publishedRoot =
    store.globals.settings.published && typeof store.globals.settings.published === "object"
      ? (store.globals.settings.published as Record<string, unknown>)
      : {};
  const core = mergeAllDocumentTypesWithOverrides(parseDocumentTypeOverridesFromSettingsRoot(publishedRoot));
  const compositions = mergeAllCompositionsWithOverrides(parseCompositionOverridesFromSettingsRoot(publishedRoot));
  const out: Record<string, DocumentTypeDefinition> = {};
  for (const k of Object.keys(core)) {
    out[k] = expandDocumentTypeWithCompositions(core[k], compositions);
  }
  return out;
}

function propagateInvariantAcrossSiblingVariantsLocal(params: {
  store: LocalCmsStore;
  pageId: string;
  environment: LocalCmsEnvironment;
  sourceBody: unknown;
  skipVariantId: string;
  timestamp: string;
}): void {
  const e = parseBodyEnvelope(params.sourceBody);
  const docKey = e.documentType != null ? String(e.documentType).trim() : "";
  const merged = getExpandedDocumentTypesForLocalCmsStore(params.store);
  const doc = docKey ? merged[docKey] ?? null : null;
  const inv = e.invariantFields;
  if (!doc || !inv || typeof inv !== "object" || Array.isArray(inv) || Object.keys(inv).length === 0) return;
  for (const v of params.store.variants) {
    if (v.page_id !== params.pageId || v.environment !== params.environment) continue;
    if (v.id === params.skipVariantId) continue;
    const next = mergeInvariantLayerIntoBody(v.body, inv, doc);
    if (JSON.stringify(next) !== JSON.stringify(v.body)) {
      v.body = next;
      v.updated_at = params.timestamp;
    }
  }
}

function resolveBodyPayloadForPatch(params: {
  requestedBody: unknown;
  requestedBlocks: unknown;
  existingBody: unknown;
}): { hasBodyUpdate: boolean; body: unknown } {
  let resolvedBody = params.requestedBody;
  const blocksTop = params.requestedBlocks;
  if (blocksTop !== undefined) {
    if (!Array.isArray(blocksTop)) {
      throw new LocalCmsRuntimeError("blocks ma vare en array.", 400, "VALIDATION_ERROR");
    }
    const previous =
      resolvedBody && typeof resolvedBody === "object" && !Array.isArray(resolvedBody)
        ? cloneValue(resolvedBody as Record<string, unknown>)
        : params.existingBody &&
            typeof params.existingBody === "object" &&
            !Array.isArray(params.existingBody)
          ? cloneValue(params.existingBody as Record<string, unknown>)
          : ({ version: 1 } as Record<string, unknown>);
    resolvedBody = {
      ...(previous as Record<string, unknown>),
      blocks: cloneValue(blocksTop),
    };
  }
  if (resolvedBody === undefined) {
    return { hasBodyUpdate: false, body: undefined };
  }
  const store = getStore();
  const publishedRoot =
    store.globals.settings.published && typeof store.globals.settings.published === "object"
      ? (store.globals.settings.published as Record<string, unknown>)
      : {};
  const mergedDt = mergeAllBlockEditorDataTypesWithOverrides(parseOverridesFromSettingsRoot(publishedRoot));
  const mergedDoc = getExpandedDocumentTypesForLocalCmsStore(store);
  const allow = validateBodyPayloadBlockAllowlist(resolvedBody, mergedDt, mergedDoc);
  if (allow.ok === false) {
    if (allow.error === "INVALID_DOCUMENT_TYPE") {
      throw new LocalCmsRuntimeError(
        `Ukjent dokumenttype «${allow.documentType}».`,
        422,
        "INVALID_DOCUMENT_TYPE",
        { documentType: allow.documentType },
      );
    }
    throw new LocalCmsRuntimeError(
      "En eller flere blokktyper er ikke tillatt for valgt dokumenttype.",
      422,
      "BLOCK_TYPES_NOT_ALLOWED",
      {
        documentType: allow.documentType,
        forbidden: allow.forbidden,
      },
    );
  }
  return { hasBodyUpdate: true, body: cloneValue(resolvedBody) };
}

export function patchLocalCmsPage(params: {
  pageId: string;
  title?: string;
  slug?: string;
  status?: unknown;
  body?: unknown;
  blocks?: unknown;
  locale?: string | null;
  environment?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
}): { page: LocalCmsPagePayload } {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const page = findPage(store, params.pageId);
  if (!page) {
    throw new LocalCmsRuntimeError("Fant ikke side.", 404, "NOT_FOUND");
  }

  const locale = (safeStr(params.locale) || "nb") as LocalCmsLocale;
  const environment = (safeStr(params.environment) || "prod") as LocalCmsEnvironment;
  const variant = ensureVariant(store, page, locale, environment);
  const titleDefined = params.title !== undefined;
  const slugDefined = params.slug !== undefined;
  const statusDefined = params.status !== undefined;
  const nextTitle = titleDefined ? safeStr(params.title) : page.title;
  const nextSlug = slugDefined ? normalizeSlug(safeStr(params.slug)) : page.slug;
  if (titleDefined && (!nextTitle || nextTitle.length > 120)) {
    throw new LocalCmsRuntimeError("title ma vare 1-120 tegn.", 400, "VALIDATION_ERROR");
  }
  if (slugDefined && (!nextSlug || nextSlug.length > 120)) {
    throw new LocalCmsRuntimeError("slug ma vare 1-120 tegn.", 400, "VALIDATION_ERROR");
  }
  if (
    nextSlug !== page.slug &&
    store.pages.some((entry) => entry.id !== page.id && entry.slug === nextSlug)
  ) {
    throw new LocalCmsRuntimeError("Slug already exists", 409, "SLUG_TAKEN");
  }

  const nextStatus =
    params.status === "published" || params.status === "draft"
      ? (params.status as LocalCmsStatus)
      : undefined;
  const resolvedBody = resolveBodyPayloadForPatch({
    requestedBody: params.body,
    requestedBlocks: params.blocks,
    existingBody: variant.body,
  });
  const timestamp = nowIso(store);

  if (titleDefined) page.title = nextTitle;
  if (slugDefined) page.slug = nextSlug;
  if (statusDefined && nextStatus) {
    page.status = nextStatus;
    page.published_at = nextStatus === "published" ? timestamp : null;
  }
  page.updated_at = timestamp;

  if (resolvedBody.hasBodyUpdate) {
    variant.body = resolvedBody.body;
    variant.updated_at = timestamp;
    propagateInvariantAcrossSiblingVariantsLocal({
      store,
      pageId: page.id,
      environment,
      sourceBody: resolvedBody.body,
      skipVariantId: variant.id,
      timestamp,
    });
  }

  const changedFields = changedFieldsFromInput({
    titleDefined,
    slugDefined,
    statusDefined: statusDefined && Boolean(nextStatus),
    bodyDefined: resolvedBody.hasBodyUpdate,
    resolvedBodyPayload: resolvedBody.body,
  });
  if (changedFields.length > 0) {
    recordVersion(store, page, variant, {
      createdBy: params.actorUserId ?? null,
      label: "Manuell lagring",
      action: "save",
      changedFields,
      createdAt: timestamp,
    });
    addAudit(store, {
      page_id: page.id,
      variant_id: variant.id,
      environment,
      locale,
      action: "save",
      actor_email: params.actorEmail ?? null,
      metadata: {
        changedFields,
        source: "local_runtime",
      },
      created_at: timestamp,
    });
  }

  return {
    page: buildPagePayload(page, variant),
  };
}

export function getLocalCmsPublishedBody(pageId: string): unknown | null {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const variant = findVariant(store, pageId, "nb", "prod");
  return variant ? cloneValue(variant.body) : null;
}

export function listLocalCmsAuditEntries(params?: {
  limit?: number;
  page_id?: string | null;
  variant_id?: string | null;
  locale?: string | null;
  environment?: string | null;
  action?: string | null;
}) {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const limit =
    typeof params?.limit === "number" && Number.isFinite(params.limit)
      ? Math.max(1, Math.min(params.limit, 100))
      : 30;
  const pageId = safeStr(params?.page_id) || null;
  const variantId = safeStr(params?.variant_id) || null;
  const locale = safeStr(params?.locale) || null;
  const environment = safeStr(params?.environment) || null;
  const action = safeStr(params?.action) || null;
  const items = store.audit
    .filter((item) => {
      if (pageId && item.page_id !== pageId) return false;
      if (variantId && item.variant_id !== variantId) return false;
      if (locale && item.locale !== locale) return false;
      if (environment && item.environment !== environment) return false;
      if (action && item.action !== action) return false;
      return true;
    })
    .slice(0, limit)
    .map((item) => ({
      ...item,
      metadata: cloneValue(item.metadata),
    }));
  return {
    items,
    source: "local_cms_runtime" as const,
    degraded: false as const,
    historyStatus: "ready" as const,
    operatorMessage:
      items.length > 0
        ? "Audit-logg hentet fra lokal CMS-runtime."
        : "Ingen audit-rader for valgt filter i lokal runtime.",
  };
}

export function getLocalCmsHeaderVariantConfig(variant: string) {
  assertReadableLocalCmsState();
  const store = getStore();
  const fromDraft = readGlobalVariantBlock(store.globals.header.draft, variant);
  if (fromDraft) return cloneValue(fromDraft);
  const fromPublished = readGlobalVariantBlock(store.globals.header.published, variant);
  return fromPublished ? cloneValue(fromPublished) : null;
}

export function saveLocalCmsHeaderVariantConfig(
  variant: string,
  payload: { title: string; nav: HeaderNavItem[] },
) {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const base = cloneValue(store.globals.header.draft);
  const currentByVariant =
    base.headerNavByVariant &&
    typeof base.headerNavByVariant === "object" &&
    !Array.isArray(base.headerNavByVariant)
      ? (cloneValue(base.headerNavByVariant) as Record<string, unknown>)
      : {};
  currentByVariant[variant] = {
    title: payload.title,
    nav: payload.nav.map((item) => ({
      label: safeStr(item.label),
      href: safeStr(item.href),
      ...(item.exact === true ? { exact: true } : {}),
    })),
  };
  base.headerNavByVariant = currentByVariant;
  saveLocalCmsGlobalDraft("header", base);
  publishLocalCmsGlobal("header");
  return getLocalCmsHeaderVariantConfig(variant) ?? {
    title: payload.title,
    nav: payload.nav,
  };
}

export function getLocalCmsWorkflow(params: {
  pageId: string;
  variantId?: string | null;
  env?: string | null;
  locale?: string | null;
}) {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const env = (safeStr(params.env) || "staging") as "prod" | "staging";
  const locale = (safeStr(params.locale) || "nb") as LocalCmsLocale;
  const page = findPage(store, params.pageId);
  if (!page) {
    throw new LocalCmsRuntimeError("Mangler page id.", 400, "BAD_REQUEST");
  }
  const fallbackVariant =
    findVariant(store, page.id, locale, "preview") ??
    resolveVariantForRead(store, page.id, locale, "preview");
  const variantId = safeStr(params.variantId) || fallbackVariant?.id || "";
  if (!variantId) {
    return {
      variantId: null,
      state: "draft" as WorkflowState,
      updated_at: undefined,
      updated_by: undefined,
    };
  }
  const item =
    store.workflows.find(
      (entry) =>
        workflowKey(entry.variant_id, entry.environment, entry.locale) ===
        workflowKey(variantId, env, locale),
    ) ?? null;
  return {
    variantId,
    state: item?.state ?? ("draft" as WorkflowState),
    updated_at: item?.updated_at,
    updated_by: item?.updated_by ?? null,
  };
}

export function transitionLocalCmsWorkflow(params: {
  pageId: string;
  variantId: string;
  env?: string | null;
  locale?: string | null;
  action: WorkflowAction;
  actorEmail?: string | null;
}) {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const page = findPage(store, params.pageId);
  if (!page) {
    throw new LocalCmsRuntimeError("Mangler page id eller variantId.", 400, "BAD_REQUEST");
  }
  const locale = (safeStr(params.locale) || "nb") as LocalCmsLocale;
  const env = (safeStr(params.env) || "staging") as "prod" | "staging";
  const variant = store.variants.find(
    (entry) => entry.id === params.variantId && entry.page_id === params.pageId,
  );
  if (!variant) {
    throw new LocalCmsRuntimeError(
      "Variant tilhorer ikke denne siden.",
      400,
      "BAD_REQUEST",
    );
  }
  const current = getLocalCmsWorkflow({
    pageId: params.pageId,
    variantId: params.variantId,
    env,
    locale,
  });
  const transition = getNextState(current.state, params.action);
  if (!transition.ok) {
    throw new LocalCmsRuntimeError(
      "Ugyldig workflow-overgang.",
      400,
      "workflow_invalid_transition",
    );
  }
  const timestamp = nowIso(store);
  const key = workflowKey(params.variantId, env, locale);
  const existingIndex = store.workflows.findIndex(
    (entry) => workflowKey(entry.variant_id, entry.environment, entry.locale) === key,
  );
  const row: LocalCmsWorkflowItem = {
    id:
      existingIndex >= 0 ? store.workflows[existingIndex]!.id : randomUuid(),
    page_id: params.pageId,
    variant_id: params.variantId,
    environment: env,
    locale,
    state: transition.next,
    updated_at: timestamp,
    updated_by: params.actorEmail ?? null,
    created_at:
      existingIndex >= 0
        ? store.workflows[existingIndex]!.created_at
        : timestamp,
  };
  if (existingIndex >= 0) {
    store.workflows[existingIndex] = row;
  } else {
    store.workflows.push(row);
  }
  addAudit(store, {
    page_id: params.pageId,
    variant_id: params.variantId,
    environment: env,
    locale,
    action: "workflow_change",
    actor_email: params.actorEmail ?? null,
    metadata: {
      from: current.state,
      to: transition.next,
      action: params.action,
      source: "local_runtime",
    },
    created_at: timestamp,
  });
  return row;
}

export function publishLocalCmsVariant(params: {
  pageId: string;
  variantId: string;
  locale?: string | null;
  actorEmail?: string | null;
  actorUserId?: string | null;
}) {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const page = findPage(store, params.pageId);
  if (!page) {
    throw new LocalCmsRuntimeError("Mangler page id eller variantId.", 400, "BAD_REQUEST");
  }
  const previewVariant = store.variants.find(
    (entry) => entry.id === params.variantId && entry.page_id === params.pageId,
  );
  if (!previewVariant) {
    throw new LocalCmsRuntimeError(
      "Variant tilhorer ikke denne siden.",
      400,
      "BAD_REQUEST",
    );
  }
  const locale = (safeStr(params.locale) || "nb") as LocalCmsLocale;
  const timestamp = nowIso(store);
  const prodVariant =
    findVariant(store, page.id, locale, "prod") ??
    (() => {
      const created: LocalCmsVariant = {
        id: randomUuid(),
        page_id: page.id,
        locale,
        environment: "prod",
        body: cloneValue(previewVariant.body),
        created_at: timestamp,
        updated_at: timestamp,
      };
      store.variants.push(created);
      return created;
    })();
  prodVariant.body = cloneValue(previewVariant.body);
  prodVariant.updated_at = timestamp;
  page.status = "published";
  page.published_at = timestamp;
  page.updated_at = timestamp;
  recordVersion(store, page, prodVariant, {
    createdBy: params.actorUserId ?? null,
    label: "Publisert lokalt",
    action: "publish",
    changedFields: ["Status", "Innhold"],
    createdAt: timestamp,
  });
  addAudit(store, {
    page_id: page.id,
    variant_id: previewVariant.id,
    environment: "prod",
    locale,
    action: CONTENT_AUDIT_ACTION_PUBLISH,
    actor_email: params.actorEmail ?? null,
    metadata: {
      source: "local_runtime",
      publishedFromVariantId: previewVariant.id,
    },
    created_at: timestamp,
  });
  return {
    published: true,
    pageId: page.id,
    variantId: previewVariant.id,
    locale,
    environment: "prod" as const,
  };
}

export function listLocalCmsVersions(params: {
  pageId: string;
  locale?: string | null;
  environment?: string | null;
}) {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const locale = safeStr(params.locale) || null;
  const environment = safeStr(params.environment) || null;
  const liveVariant =
    locale && environment
      ? findVariant(store, params.pageId, locale, environment)
      : null;
  const versions = store.versions
    .filter((version) => {
      if (version.page_id !== params.pageId) return false;
      if (locale && version.locale !== locale) return false;
      if (environment && version.environment !== environment) return false;
      return true;
    })
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .map((version) => ({
      id: version.id,
      pageId: version.page_id,
      versionNumber: version.version_number,
      locale: version.locale,
      environment: version.environment,
      createdAt: version.created_at,
      createdBy: version.created_by,
      label: version.label,
      action: version.action,
      changedFields: [...version.data.changedFields],
      isActive:
        liveVariant != null &&
        liveVariant.locale === version.locale &&
        liveVariant.environment === version.environment &&
        snapshotBodyEquals(liveVariant.body, version.data.body),
    }));
  return { versions };
}

export function getLocalCmsVersionPreview(params: {
  pageId: string;
  versionId: string;
}) {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const version = store.versions.find((entry) => entry.id === params.versionId) ?? null;
  if (!version || version.page_id !== params.pageId) {
    throw new LocalCmsRuntimeError("Versjon ikke funnet.", 404, "NOT_FOUND");
  }
  return {
    preview: {
      versionId: version.id,
      versionNumber: version.version_number,
      label: version.label,
      title: version.data.page.title,
      slug: version.data.page.slug,
      status: version.data.page.status,
      published_at: version.data.page.published_at,
      body: cloneValue(version.data.body),
      changedFields: [...version.data.changedFields],
    },
  };
}

export function rollbackLocalCmsVersion(params: {
  pageId: string;
  versionId: string;
  expectedUpdatedAt?: string | null;
  actorEmail?: string | null;
  actorUserId?: string | null;
}) {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const page = findPage(store, params.pageId);
  if (!page) {
    throw new LocalCmsRuntimeError(
      "Versjon ikke funnet for denne siden.",
      404,
      "NOT_FOUND",
    );
  }
  if (safeStr(params.expectedUpdatedAt)) {
    const expectedTs = Date.parse(safeStr(params.expectedUpdatedAt));
    const currentTs = Date.parse(page.updated_at);
    if (!Number.isNaN(expectedTs) && !Number.isNaN(currentTs) && expectedTs !== currentTs) {
      throw new LocalCmsRuntimeError(
        "Siden ble oppdatert mens du arbeidet. Last innhold og historikk pa nytt.",
        409,
        "PAGE_STALE",
      );
    }
  }
  const version = store.versions.find((entry) => entry.id === params.versionId) ?? null;
  if (!version || version.page_id !== params.pageId) {
    throw new LocalCmsRuntimeError(
      "Versjon ikke funnet for denne siden.",
      404,
      "NOT_FOUND",
    );
  }
  const locale = version.locale;
  const environment = version.environment;
  const currentVariant = ensureVariant(store, page, locale, environment);
  const backup = recordVersion(store, page, currentVariant, {
    createdBy: params.actorUserId ?? null,
    label: "Gjenopprettet versjon",
    action: "rollback",
    changedFields: ["Innhold"],
  });
  const timestamp = nowIso(store);
  page.title = version.data.page.title;
  page.slug = version.data.page.slug;
  page.status = version.data.page.status;
  page.published_at = version.data.page.published_at;
  page.updated_at = timestamp;
  currentVariant.body = cloneValue(version.data.body);
  currentVariant.updated_at = timestamp;
  addAudit(store, {
    page_id: page.id,
    variant_id: currentVariant.id,
    environment,
    locale,
    action: "rollback",
    actor_email: params.actorEmail ?? null,
    metadata: {
      source: "local_runtime",
      restoredVersionId: version.id,
      restoredVersionNumber: version.version_number,
    },
  });
  return {
    page: buildPagePayload(page, currentVariant),
    backupVersionId: backup.id,
  };
}

export function getLocalCmsPublishedGlobal(key: GlobalContentKey) {
  assertReadableLocalCmsState();
  const store = getStore();
  const state = store.globals[key];
  return {
    data: cloneValue(state.published),
    version: state.publishedVersion,
  };
}

export function saveLocalCmsGlobalDraft(
  key: GlobalContentKey,
  data: Record<string, unknown>,
):
  | { ok: true; version: number; draft: Record<string, unknown> }
  | { ok: false; message: string } {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const state = store.globals[key];
  state.draft = cloneValue(data);
  state.draftVersion += 1;
  state.updated_at = nowIso(store);
  return {
    ok: true,
    version: state.draftVersion,
    draft: cloneValue(state.draft),
  };
}

export function publishLocalCmsGlobal(
  key: GlobalContentKey,
):
  | { ok: true; data: Record<string, unknown>; version: number }
  | { ok: false; message: string } {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const state = store.globals[key];
  state.published = cloneValue(state.draft);
  state.publishedVersion += 1;
  state.updated_at = nowIso(store);
  return {
    ok: true,
    data: cloneValue(state.published),
    version: state.publishedVersion,
  };
}

export function getLocalCmsPublicContentBySlug(
  slug: string,
  options?: { preview?: boolean },
) {
  assertLocalRuntimeEnabled();
  const store = getStore();
  const page = findPageBySlug(store, slug);
  if (!page || page.status !== "published") return null;
  const environment = options?.preview === true ? "preview" : "prod";
  const variant = findVariant(store, page.id, "nb", environment);
  if (!variant) return null;
  return {
    pageId: page.id,
    slug: page.slug,
    title: page.title,
    body: cloneValue(variant.body),
    experimentAssignment: null,
  };
}


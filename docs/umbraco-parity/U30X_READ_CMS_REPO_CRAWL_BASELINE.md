# U30X-READ-R2 — CMS / backoffice repo crawl baseline

**Fase:** U30X-READ-R2 (kun lesing). **Kilde:** faktisk kode og migrasjoner i repo per kartlegging.

## Hva er faktisk CMS/backoffice i repoet akkurat nå?

### Primær CMS (Next.js App Router, superadmin-gate)

- **`app/(backoffice)/backoffice/**`** — hele backoffice-flaten (superadmin-only i `layout.tsx` via `getAuthContext` + redirect for ikke-superadmin).
- **Innholdsredaktør:** `app/(backoffice)/backoffice/content/**` — stor klient-drevet workspace (`ContentWorkspace.tsx`), tre (`ContentTree.tsx`), API-kall til `app/api/backoffice/content/**`.
- **Settings:** `app/(backoffice)/backoffice/settings/**` — layout + sider for `document-types`, `data-types`, `schema`, `create-policy`, `create-options` (Umbraco-paritet på IA-nivå).
- **Øvrige backoffice-flater:** `ai`, `ai-control`, `control`, `media`, `system`, `sales`, `sales-machine`, `acquire`, `autonomy`, `preview` — kontroll-/vekst-/overflate-UI, ikke nødvendigvis samme modenhet som content workspace.

### Sekundært / parallelt (ikke “én editor”, men påvirker CMS-sannhet)

- **`studio/**`** — Sanity Studio (meny, weekPlan, produktplaner). **DEPRECATED** undermappe (`lunchportalen-studio/DEPRECATED.md`). Operativ menykilde er fortsatt knyttet til publisert kjede (jf. `lib/cms/moduleLivePosture.ts` og CMS-control-plane docs).
- **`lib/cms/**`** — kontrakter, envelope, governance, public render pipeline, backoffice nav/registry, discovery.

### Indirekte støtte (påvirker editor via API eller UI)

- **`app/api/backoffice/**`** — content, media, AI, experiments, releases, esg, company, enterprise, ceo, revenue, autonomy, cms, etc.
- **`components/backoffice/**`, `components/cms/**`** — command palette, extension strip, delte kontrollplan-komponenter.
- **`middleware.ts`** — global gate (må leses ved endringer; ikke endret i denne fasen).

## Aktive / halvferdige / degraderte / ødelagte

| Område | Vurdering | Bevis i kode |
|--------|-----------|--------------|
| **Content tree** | **Aktiv** med **degraderingssti** | `GET /api/backoffice/content/tree` — `isTreeRouteDegradableSchemaError`, virtuelle røtter ved schema/cache-problemer (`content/tree/route.ts`, `lib/cms/treeRouteSchema.ts`). |
| **Audit-log** | **Aktiv** med **degradering** | `GET /api/backoffice/content/audit-log` — `degraded: true` + tom liste hvis `content_audit_log` utilgjengelig (`audit-log/route.ts`, `lib/cms/auditLogTableError.ts`). Tabell finnes i migrasjoner (`20260229000001_content_audit_log_workflow.sql`). |
| **Governance usage** | **Aktiv** (read-only scan) | `GET /api/backoffice/content/governance-usage` — skanner `content_page_variants` (cap 8000). |
| **Content `/backoffice/content` root** | **Ikke klassisk editor**; **vekst-dashboard** | `content/page.tsx` rendrer **`GrowthDashboard`** — ikke tre+workspace; editor er under **`/backoffice/content/[id]`**. |
| **Editor 2.0** | **Stub / ikke aktiv** | `_stubs.ts` eksporterer `Editor2Shell` som returnerer `null` og sier `useEditor2=false`. |
| **Document types (lib)** | **Minimal** | `lib/cms/contentDocumentTypes.ts` eksporterer `documentTypes` med kun `alias: "page"` — begrenset Umbraco-lignende mangfold. |
| **Modal “_stubs”** | **Navnet misvisende** | `_stubs.ts` re-eksporterer **ekte** `BlockAddModal`, `BlockEditModal`, `MediaPickerModal` — ikke placeholder-modaler. |

## Hva styrer editoropplevelsen?

1. **Route:** `content/[id]/page.tsx` → `ContentEditor` → `ContentWorkspace`.
2. **Layout:** `content/layout.tsx` → `ContentWorkspaceLayout` + `MainViewProvider` — **tre** venstre + `SectionShell` grid; **når `selectedNodeId` satt** rendres `ContentEditor` fra layout; **ellers** `children` (f.eks. GrowthDashboard på `/content`).
3. **Tre-navigasjon:** `ContentTree` sync’er med URL (`pathnameSelectedId`), `router.push` til `/backoffice/content/{uuid}`.
4. **State:** `ContentWorkspace.tsx` (2000+ linjer) orkestrerer blokker, modaler, AI, design/global/presentasjonsflagg, outbox, m.m.

## Hva styrer settings / governance?

- **Kode:** `lib/cms/blockAllowlistGovernance.ts`, `bodyEnvelopeContract.ts`, `legacyEnvelopeGovernance.ts`, `contentGovernanceUsage.ts`, `backofficeSchemaSettingsModel.ts`.
- **API:** `governance-usage`, `governance-registry`, `batch-normalize-legacy`, content pages PATCH med variant.
- **Settings-UI:** `backoffice/settings/*` — leser/viser modeller; grad av DB- vs kode-styring varierer per side (se egen settings-rapport).

## Områder som “later som first-class”

- **Mange paneler** i workspace (GTM, CEO, revenue, enterprise insights, …) — **faktisk** avhenger av egne API-ruter og modulposture; flere er `LIMITED` / `DRY_RUN` i `moduleLivePosture.ts`.
- **Umbraco 17 / Bellissima**-språk i `backofficeExtensionRegistry.ts` og docs — **manifest-lignende** nav, men implementasjon er **Next.js + React**, ikke Umbraco.

## Konklusjon (baseline)

CMS/backoffice er **CMS-led men fragmentert**: én tung **ContentWorkspace**-monolitt, **parallelle** kontroll-/vekst-flater, **Sanity Studio** for deler av operativ data, og **PostgreSQL** `content_*` for sider/varianter. **Ikke** én sammenhengende Umbraco-17-lignende shell; **nær** på enkelte IA-biter (tre bredde, settings-seksjon), **langt** på enhetlig editor workspace og dokumenttype-økosystem.

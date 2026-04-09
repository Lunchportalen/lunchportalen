# U30X-READ-R3 — Bellissima baseline (repo-sannhet)

**Fase:** read-only crawl · **Kilde:** kode i repo (mars 2026) · **Skjermbilder vedlagt:** nei (eksplisitt: ingen UX-snapshots i denne kjøringen) · **Dev-/terminallogg vedlagt:** nei

## Hva som faktisk utgjør CMS / backoffice

| Område | Bevis (filer / ruter) | Klassifisering |
|--------|------------------------|----------------|
| Shell + navigasjon | `app/(backoffice)/backoffice/_shell/BackofficeShell.tsx`, `TopBar.tsx`, `lib/cms/backofficeExtensionRegistry.ts` | **CODE_GOVERNED** — statisk manifest-lignende liste, ikke Umbraco extension pipeline |
| Content-seksjon layout | `app/(backoffice)/backoffice/content/layout.tsx` → `ContentWorkspaceLayout.tsx` + `SectionShell.tsx` | **PARTIAL** — tre + workspace-grid, men ikke samlet entity/workspace-modell |
| Tree API | `app/api/backoffice/content/tree/route.ts` → `content_pages` | **RUNTIME_TRUTH** — eksplisitt degradert modus ved manglende tabell/kolonne |
| Side-redaktør | `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` (stor klientkomponent) | **PARTIAL** — funksjonell editor, men state er React-lokal/hooks, ikke isolert workspace context |
| Innholdsliste «landing» | `app/(backoffice)/backoffice/content/page.tsx` → `GrowthDashboard.tsx` | **UX_PARITY_ONLY / MISLEADING** — `/backoffice/content` er ikke klassisk innholds-arbeidsflate (site growth), ikke tree-first workspace entry |
| Editor-rute | `app/(backoffice)/backoffice/content/[id]/page.tsx` → `ContentEditor.tsx` | **CODE_GOVERNED** |
| Settings | `app/(backoffice)/backoffice/settings/**` + `BACKOFFICE_SETTINGS_BASE_PATH` i registry | **PARTIAL** — egen seksjon, ikke Umbraco data type / document type management |
| Media, preview, AI | `app/api/backoffice/media/**`, `app/(backoffice)/backoffice/preview/**`, `app/api/backoffice/ai/**` | **PARTIAL** — ad hoc API-er |

## Hva som bare støtter CMS indirekte

- **Ordre / uke / kjøkken / driver / admin** — runtime-kjeder; ikke Bellissima content workspace, men deles topbar/palett via `backofficeExtensionRegistry`.
- **Sanity** — fortsatt referert i modulposture (`moduleLivePosture.ts` for operativ meny) — **ikke** Postgres content som eneste sannhet for alt.
- **Supabase RLS / superadmin** — gates på API (f.eks. tree `superadmin`).

## Aktivt vs degradert vs ødelagt vs transitional

| Tilstand | Eksempel | Parity-klasse |
|----------|----------|---------------|
| Aktiv med fail-closed fallback | Tree: `jsonOk` med `degraded: true` når `content_pages` mangler | **DEGRADED** (rute returnerer 200 med flagg — ikke «ødelagt HTTP», men redaksjonelt tomt) |
| Aktiv read-only degradert | Audit: `app/api/backoffice/content/audit-log/route.ts` → tom liste hvis `content_audit_log` mangler | **DEGRADED** |
| Schema-fleksibilitet | `page_key` kolonne fallback i tree | **PARTIAL** — inferens fra slug |
| «Førsteklasses» dokumenttyper | `lib/cms/contentDocumentTypes.ts` — kun `page` med alle blokker | **STRUCTURAL_GAP** vs Umbraco document type modell |
| Editor 2.0 | `_stubs.ts` `Editor2Shell` returnerer `null` | **STUB** (eksplisitt i kode) |

## Subsystemer målt mot Umbraco 17 i denne fasen

1. Extension manifest / registry / bundles  
2. Section / menu / tree / collection / workspace  
3. Workspace context / views / actions / footer apps / entity actions  
4. Document type / data type / property editor / presets  
5. Management vs delivery (API-grenser)  
6. AI governance (posture, approval, provider)  
7. Runtime schema (Postgres tabeller vs kodeantakelser)  
8. Dokumentasjon vs kode (doc drift)

## Sluttdom (baseline)

Lunchportalen har **UX-lignende lag** (TopBar-manifest, section shell, tree) men **ikke** Umbraco 17 Bellissima **strukturell paritet**: ingen dynamisk extension pipeline, ingen workspace context runtime, ingen entity action-pluggbarhet som i CMS-rammeverket.

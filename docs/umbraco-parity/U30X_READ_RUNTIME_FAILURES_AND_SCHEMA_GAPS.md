# U30X-READ-R2 — Runtime failures & schema gaps

**Bevis:** implementasjonskode + migrasjonsfiler + eksisterende intern logg-doc `U30X_RUNTIME_FAILURES_FROM_LOGS.md`. **Ingen dev-server kjørt i denne READ-fasen.** Cursor-terminal snapshot viste kun `npm run typecheck` **PASS** (ingen runtime-feil i logg).

## Eksplisitte ruter (påkrevd i scope)

| Route | Failure / atferd | Evidence | Likely schema truth | Severity | Neste fase |
|-------|-------------------|----------|---------------------|----------|------------|
| `GET /api/backoffice/content/tree` | Historisk 500 ved kolonne-mismatch; nå **degraderbar** til virtuelle røtter | `tree/route.ts`, `treeRouteSchema.ts`, tester nevnt i `U30X_RUNTIME_FAILURES_FROM_LOGS.md` | `content_pages` + tree-kolonner (`tree_parent_id`, `tree_root_key`, `tree_sort_order`, `page_key` — migrasjoner `20260327000000_*`, `20260417010000_*`) | **Høy** hvis DB halv-migrert | Verifiser migrasjoner i miljø; behold degradering |
| `GET /api/backoffice/content/audit-log` | **200** med `degraded: true` + tom liste hvis tabell utilgjengelig | `audit-log/route.ts`, `auditLogTableError.ts` | `content_audit_log` finnes i `20260229000001_*` | **Middels** | Drift: sikre migrert DB for faktisk historikk |
| `GET /api/backoffice/releases*` | Ikke fullstendig analysert per request — **avhenger av** `content_releases` e.l. | `app/api/backoffice/releases/**` | Sjekk migrasjoner som matcher routes | **Varierer** | Les `releases/route.ts` + DB ved implementasjon |
| `GET /api/backoffice/esg/latest-monthly` | ESG rollup — egen lib | `lib/esg/latestMonthlyRollupList.ts` | Tabeller definert i `lib/esg/*` + migrasjoner | **Lav–middels** for ren editor | Fail isolert fra block editor med mindre panel kaller den |
| `GET /api/backoffice/ai/intelligence/dashboard` | 500 ved `getSystemIntelligence` feil | `intelligence/dashboard/route.ts` | `ai_intelligence_events` + annen intel (se `lib/ai/intelligence`) | **Middels** for kontrollpanel | Overvåk 500 i staging |

## Schema — verifiserte objekter (fra migrasjoner / kode)

| Artefakt | Finnes i repo | Kode antar |
|----------|---------------|------------|
| `content_pages` | Ja (flere migrasjoner) | Tree + pages API |
| `content_page_variants` | Ja (governance-usage, pages PATCH) | Body ligger her |
| `content_audit_log` | Ja | Audit route; degradering hvis mangler |
| `ai_intelligence_events` | Ja (`20260323140000_ai_intelligence_events.sql`) | Intelligence streams |
| `media_items` | Forventes av media API | `app/api/backoffice/media/**` |

## Klassiske gap / drift

1. **Delvis migrert DB:** tree-route **skal** degradere i stedet for hard fail — fortsatt **dårlig brukeropplevelse** (tomt tre uten sider).
2. **Audit uten tabell:** redaksjonell historikk **forsvinner** uten feilmelding til sluttbruker i API — kun `degraded` flagg (klient må respektere).
3. **`page_key`:** unik indeks og backfill i migrasjoner — kode har **fallback** inferens (`contentTreePageKey.ts`).

## Hva koden *ikke* skal gjette på

- At **alle** dokumenttyper finnes i DB — `lib/cms/contentDocumentTypes.ts` er **minimal** (`page` only).
- At **audit** alltid er tilgjengelig — eksplisitt degradert gren.

## Mest kritisk for editor/backoffice

1. **`/api/backoffice/content/tree`** — uten den: tre lastes ikke / degradert.  
2. **`/api/backoffice/content/pages` + `/pages/[id]`** — uten: ingen editor-data.  
3. **`PATCH /api/backoffice/content/pages/[id]`** — kjerne for lagring.

Alt annet (AI dashboard, ESG, releases) er **adjacent** — kan feile uten å stoppe blokkskriving, avhengig av hvilke paneler som er synlige.

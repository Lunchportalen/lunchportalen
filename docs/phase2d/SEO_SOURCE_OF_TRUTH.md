# SEO / CMS Growth — source of truth (2D2)

**Dato:** 2026-03-28  
**Status:** Runtime MVP — **én** kanonisk modell; ingen parallell SEO-database.

---

## 1. Kanonisk datamodell

| Lag | Kilde | Kommentar |
|-----|-------|-----------|
| **Sider** | `content_pages` (id, title, slug, status, …) | Offisiell sideidentitet. |
| **Variant / innhold** | `content_page_variants.body` (jsonb) | `blocks` + `meta` i samme dokument — **meta.seo** er SEO-sannhet for rendering (`lib/cms/public/cmsPageMetadata.ts`). |
| **Page AI Contract** | `body.meta` — `seo`, `social`, `intent`, `cro`, `diagnostics` | `lib/cms/model/pageAiContract.ts` — feltnavn er låst der. |
| **SEO-analyse (lesing)** | `POST /api/backoffice/ai/seo-intelligence` → `computeSeoIntelligence` | Deterministisk score + forslag; **ingen** auto-skriv til DB. |
| **Persistert analysehistorikk** | `body.meta.seoRecommendations` (valgfritt etter lagring fra SEO-flaten) | Struktur fra `lib/seo/intelligence.ts` (`mergeSeoRecommendationsIntoMeta`). |

---

## 2. Kanonisk editorflyt

1. **Innholdsredigerer** (`/backoffice/content/[id]`) — full redigering, publisering, workflow.  
2. **SEO & vekst** (`/backoffice/seo-growth`) — **fokus**: sidevalg, analyse, forslag, redigerte SEO-felt, **lagring** via `PATCH /api/backoffice/content/pages/[id]` med `x-lp-cms-client: content-workspace` når `body` sendes.

**Ingen** separat SEO-app utenfor backoffice.

---

## 3. Aktive vs legacy spor

| Spor | Status |
|------|--------|
| `ContentWorkspacePropertiesRail` / `ContentSeoPanel` | **Aktiv** — detaljert SEO i redigereren. |
| **`/backoffice/seo-growth`** | **Aktiv (2D2)** — oversikt, analyse, hurtig lagring av `meta.seo`. |
| `POST /api/ai/growth/seo` (`runSeoEngine`) | **Eksisterende** — site-level growth; **ikke** duplisert i 2D2 UI. |
| `lib/ai/growthEngine.ts` | **Read-only** bundle — uendret. |
| Sanity / eldre marketing-spor | **Legacy** der fortsatt i bruk for spesifikke typer — **ikke** primær for CMS-sider i Postgres. |

---

## 4. Publisering

- **Ikke** fra SEO-flaten alene — bruker må gå til innholdsredigerer / workflow / `variant/publish` etter eksisterende regler (`workflow_not_approved` mv.).

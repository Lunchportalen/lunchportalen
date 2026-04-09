# CMS Control Plane — Source of truth map

**Dato:** 2026-03-29

**Klasser:** `CMS_CONTROLLED` · `RUNTIME_TRUTH` · `DERIVED_FROM_RUNTIME` · `REVIEW_ONLY` · `DRY_RUN` · `STUB` · `NEEDS_CONSOLIDATION`

---

## Innhold & design

| Del | Klasse | Kommentar |
|-----|--------|-----------|
| Content pages (Postgres), tree, variants | **CMS_CONTROLLED** | Backoffice API + publish. |
| Media library, published asset refs | **CMS_CONTROLLED** | Scope i API. |
| Block definitions / design tokens (phase2a) | **CMS_CONTROLLED** + **REVIEW_ONLY** for AI-forslag | AI apply krever roller. |
| Sanity Studio schemas (dish, weekPlan, …) | **CMS_CONTROLLED** (Sanity) | Separat livssyklus fra Postgres pages. |

## Operativ kjerne

| Del | Klasse | Kommentar |
|-----|--------|-----------|
| Auth session, `profiles.company_id` | **RUNTIME_TRUTH** | Server-side sannhet. |
| Orders, order events | **RUNTIME_TRUTH** | Immutable hendelser — ikke CMS. |
| `GET /api/week` response (meny + avtale + synlighet) | **DERIVED_FROM_RUNTIME** | Avledet fra Supabase + Sanity menu content. |
| `lib/week/availability.ts` rules | **RUNTIME_TRUTH** | Tidsvinduer — ikke overstyrt av CMS-tekst. |
| Agreement row / `company_current_agreement` | **RUNTIME_TRUTH** | CMS kan vise, ikke erstatte uten migrasjon. |

## Sanity «uke»-spor

| Del | Klasse | Kommentar |
|-----|--------|-----------|
| `weekPlan` dokumenter | **CMS_CONTROLLED** (editorial) | `lib/cms/weekPlan.ts` sier eksplisitt: ikke employee operativ sannhet. |
| `POST /api/weekplan/publish` | **CMS_CONTROLLED** (publish action) | Superadmin-gate; policy i route. |
| Employee week UI data | **DERIVED_FROM_RUNTIME** | Henter via `/api/week`, ikke `fetchCurrentWeekPlan` som autoritet for bestilling. |

## Økonomi

| Del | Klasse | Kommentar |
|-----|--------|-----------|
| Invoice engine, billing periods | **RUNTIME_TRUTH** | `lib/billing/**`. |
| Stripe / webhooks der brukt | **RUNTIME_TRUTH** | — |

## Growth

| Del | Klasse | Kommentar |
|-----|--------|-----------|
| SEO metadata etter publish | **DERIVED_FROM_RUNTIME** / **CMS_CONTROLLED** (avhengig av lag) | Krever konsistent publish-flyt. |
| Social poster rows | **RUNTIME_TRUTH** (DB) | Ekstern publish kan være **DRY_RUN**. |
| `lib/social/executor` eksterne kall | **DRY_RUN** / **STUB** (kanalavhengig) | Se phase2d / executor. |
| ESG summaries | **DERIVED_FROM_RUNTIME** | Aggregater; UI **REVIEW_ONLY** tolkning. |

## Workers

| Del | Klasse | Kommentar |
|-----|--------|-----------|
| `workers/worker.ts` job handlers | **STUB** for enkelte typer | Enterprise doc lister send_email, ai_generate, … |

## Samlet

| Del | Klasse |
|-----|--------|
| Hele «growth» flaten på tvers av superadmin/backoffice/scripts | **NEEDS_CONSOLIDATION** (IA + eier, ikke nødvendigvis ny DB) |

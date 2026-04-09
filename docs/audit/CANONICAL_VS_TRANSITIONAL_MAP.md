# Canonical vs transitional map (V2)

**Formål:** Én side for «hva er fasit nå» vs «under innfasing».

## Domeneflate → status

| Flate | Canonical entry (typisk) | Status | Notat |
|-------|--------------------------|--------|-------|
| Offentlig markedsføring | `app/(public)/**`, `app/(public)/[slug]` | **CANONICAL** | SEO/CRO-kritiske sider. |
| Employee ukevisning | `app/(app)/week/page.tsx`, `/week` route (build output) | **CANONICAL** | `app/(portal)/week` slettet i branch — sannhet er `(app)/week`. |
| Ordre / vindu | `app/api/order/**`, `app/api/orders/**`, `lib/week/**` | **CANONICAL** + **TRANSITIONAL** | Flere ordre-endepunkter; `lib/system/routeRegistry.ts` dokumenterer legacy vs dag3. |
| Company admin | `app/admin/**` | **CANONICAL** | Layout med server guards (ikke endret i denne audit). |
| Superadmin | `app/superadmin/**` | **CANONICAL** | Mange «tower»- og labsider — forretnings kritisk del er firma/system. |
| Kitchen | `app/kitchen/**`, `app/api/kitchen/**` | **CANONICAL** | Produksjonsliste / batch API. |
| Driver | `app/driver/**`, `app/api/driver/**` | **CANONICAL** | |
| Backoffice CMS | `app/(backoffice)/backoffice/**` | **CANONICAL** + **TRANSITIONAL** | Stor `_components/`-flate; dokumentert i phase2b/2d. |
| Growth / AI «motor» (backoffice + superadmin) | `app/(backoffice)/backoffice/*`, `app/superadmin/*`, `lib/ai/**` | **TRANSITIONAL** | Omfattende; ikke alt er produksjonskritisk pilot-scope. |
| SaaS onboarding/billing pages | `app/saas/**`, `app/api/saas/**` | **TRANSITIONAL** | Egen produktflate ved siden av kjerne lunch-flyt. |

## Datakilde-sannhet (kort)

| Område | Canonical kilde |
|--------|-----------------|
| Bruker rolle / scope | Server-side scope (`getScope` / `scopeOr401`) — se `lib/http/routeGuard.ts` |
| Week synlighet fredag | `lib/week/availability.ts` (15:00 — dokumentert i `docs/hardening/RESOLVED_BASELINE_ITEMS.md`) |
| CMS sider / trær | Supabase-tabeller via `app/api/backoffice/content/**` (se API-rapport) |
| ESG tall (forenklet) | Flere API-lag (admin/backoffice/superadmin) — **TRANSITIONAL** konsolidering |

## Mapper som er «overgang»

| Mappe | Hvorfor |
|-------|---------|
| `src/components` | Del av design-system migrering; overlapper `components`. |
| `studio` | CMS-redaksjon utenfor Next typecheck. |
| `lib/pos`, `lib/evolution`, `lib/domination` | Strategi/POC-aktig kode ved siden av kjerne — **TRANSITIONAL** / **NEEDS_REVERIFICATION** for pilot. |

## Mapper som er legacy / arkiv

| Mappe | Klassifisering |
|-------|----------------|
| `archive/**` | **LEGACY** |
| `docs/audit/full-system/*` eldre rapporter | **HISTORICAL** (kan inneholde utdaterte påstander) |

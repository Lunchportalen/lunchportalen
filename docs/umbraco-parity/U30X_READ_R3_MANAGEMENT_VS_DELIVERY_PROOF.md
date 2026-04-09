# U30X-READ-R3 — Management vs delivery proof

## Matrise

| Surface / API | Management | Delivery | Shared contract | Leaky boundary? | Why |
|---------------|------------|----------|-----------------|-----------------|-----|
| `app/api/backoffice/content/pages/**` | Ja (CRUD, variant, workflow) | Nei | JSON `{ ok, rid, data }` | Lav hvis guard OK | Superadmin/rolle i routes |
| `app/api/backoffice/content/tree` | Ja | Nei | Tree noder | Lav | superadmin-only |
| `lib/cms/public/getContentBySlug.ts`, `loadLivePageContent.ts` | Nei | Ja (public/les) | `content_pages` + `content_page_variants` | **MEDIUM** — samme tabeller som editor | Én DB-sannhet; krever korrekt `environment`/`locale` |
| `app/(public)/[slug]/page.tsx` | Nei | Ja | Render fra CMS loaders | Lav hvis kun published | — |
| `app/api/week/**`, `app/api/orders/**` | Nei (operativ) | Ja | Ordre/uke | **Lav** — annet domene | Ikke «content management» |
| `app/api/backoffice/ai/**` | Ja (orchestration) | Delvis (noen til preview) | AI metrics events | **MEDIUM** — editor kan trigge | Krever god gate |
| Settings/governance API | `governance-registry`, `governance-usage` | Nei | Read models | Lav | — |
| Preview | `app/(backoffice)/backoffice/preview/[id]/page.tsx` | «Delivery-lignende» men auth | Variant env | **MEDIUM** | Preview er ikke public delivery |

## Bellissima referanse

- **Management API** (Umbraco) vs **Delivery API** — Lunchportalen bruker **Next.js route handlers** + **direkte Supabase** i stedet for adskilte Umbraco endpoints; **STRUCTURAL_GAP** på plattformgrense, **CODE_GOVERNED** på applikasjonsnivå.

## Sluttdom

Grensen er **bevisst i kode** (`/api/backoffice/*` vs `lib/cms/public/*`), men **ikke** samme som Umbraco 17 Management/Delivery **produkt-skille** — **REPLATFORMING_GAP** hvis målet er API-paritet med Umbraco.

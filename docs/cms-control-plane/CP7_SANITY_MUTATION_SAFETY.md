# CP7 — Sanity mutation safety

## Klienter og tokens i repoet

| Komponent | Fil | Bruk |
|-----------|-----|------|
| Les klient (CDN) | `lib/sanity/client.ts` → `sanity` | `useCdn: true` — publisert innhold, hurtigcache |
| Skriv klient | `lib/sanity/client.ts` → `sanityWrite` | Aktiveres kun hvis `SANITY_WRITE_TOKEN` er satt |
| `requireSanityWrite()` | `lib/sanity/client.ts` | Kaster hvis token mangler |
| Env | `lib/config/env.ts` | `getSanityWriteToken()`, `requireSanityWriteToken()` |
| Eksisterende mønster | `lib/sanity/weekPlanOps.ts` | Patch/commit på `weekPlan` |

## Kan publish/mutate gjøres trygt fra backoffice?

- **Ja, med forutsetninger:**
  - Route er **superadmin-only** (`scopeOr401` + `requireRoleOr403`).
  - **`SANITY_WRITE_TOKEN`** må finnes i server-miljø (aldri i klient).
  - **Fail-closed:** Uten token returnerer publish-API **503** med tydelig melding.
- **menuContent publish** bruker `apiVersion: 2025-02-19` på skriveklienten for Actions API-kompatibilitet.

## Hemmeligheter

- **`SANITY_WRITE_TOKEN`** — kreves for broker; må ha skrivetilgang til aktuelt datasett.
- **`NEXT_PUBLIC_SANITY_*`** — prosjekt/dataset/versjon (les); ikke hemmelig men må samsvare med Studio.

## Fail-closed oppførsel

- Manglende token → ingen stille fallback; API svarer 503.
- Ugyldig dato → 422.
- Ingen dokument / ingen draft → 404 eller «noop» med forklaring.
- Sanity-feil → 502 med detalj i RC/dev (`jsonErr` detail).

## Preview vs publish

- **Lesing** til ansatt/forhåndsvisning følger fortsatt `lib/sanity/queries.ts` / `lib/cms/menuContent.ts` (publisert + kundesynlig filter).
- **Publish** flytter innhold fra draft til publisert perspektiv — samme konsept som Studio; ingen alternativ «preview-sannhet» i LP-DB.

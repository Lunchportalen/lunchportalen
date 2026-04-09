# REMAINING_TOP_10

Kun problemer som **gjelder nå** etter CMS FASE 1–15 og delta-fiks (lint, duplikat-fil, parity-test, something-route). Ingen historiske «allerede løst»-elementer.

| # | Title | Severity | Evidence | Root cause | Why it still matters | Recommended next step | Fix now? |
|---|--------|----------|----------|------------|----------------------|----------------------|----------|
| 1 | **Stor `ContentWorkspace.tsx` (~6k+ linjer)** | High | PowerShell linjetelling **6401**; `IMPLEMENTATION_LOG.md` beskriver fortsatt tung skall | Mange år med feature-akk i én entry; refaktor har flyttet **logikk**, ikke full **komposisjonsdiett** | Review-kost, regressjonsrisiko, vanskelig onboarding | Fortsett kontrollert utbrytning (allerede mønster i loggen); unngå ny logikk i skallet | **No** (strukturell) |
| 2 | **ESLint hook/img-warnings i CMS** | Medium | `npm run lint`: mange `exhaustive-deps` + `no-img-element` i `ContentWorkspace.tsx` og relaterte filer | Stor komponentflate + bevisst avveining på deps / `<img>` i editor | Skjulte re-render/feil; LCP i preview | Prioritert opprydding per modul; `next/image` der det er trygt | **No** (bred) |
| 3 | **Stor APIflate** | High | `git ls-files "**/route.ts"` → **324** | Mange domener i én app | Authz-feilflate, review-kost | Konsolidering over tid; behold `audit:api` | **No** |
| 4 | **`lib/ai` omfang (~295 filer)** | High | `git ls-files lib/ai` → **295** | Parallell plattformvekst | Drift, kognitiv last, coupling | Grenser/feature flags; ikke mer «løs vekst» | **No** |
| 5 | **`global_content` RLS: brede `authenticated`-policies** | High (kondisjonell) | `20260421000000_global_content.sql` | Policy design for fleksibel klient | **Kritisk** hvis klient skriver direkte mot Supabase med bruker-token | Kartlegg **alle** skrivebaner (server-only vs bruker-klient); stram RLS eller fjern direkte skriving | **No** (krever trace) |
| 6 | **JSONB / `withDefaults` uten full runtime-schema** | Medium | `POST_IMPLEMENTATION_REVIEW.md` nevner neste steg Zod/jsonb | Fleksibilitet før streng validering | Data drift, rare tilstander | Zod ved skrivegrense for globale/settings | **No** |
| 7 | **Build robusthet (heap / Next artefakter)** | Medium | `IMPLEMENTATION_LOG` heap 8192; denne økten: `build:enterprise` feilet med `ENOENT` pages-manifest etter kompilering | Stor app + Windows/Next | Uforutsigbar lokal/CI-opplevelse | Dokumenter `NODE_OPTIONS`; ren `.next`; følg CI Linux | **No** (miljø) |
| 8 | **E2E ikke del av denne verifiseringen** | Medium | Ikke kjørt | — | Regresjon utenfor unit | Kjør `e2e` i CI / lokalt med server | **No** |
| 9 | **Andre tester med `@ts-nocheck`** (f.eks. `publishFlow.test.ts`) | Low–Medium | `tests/cms/publishFlow.test.ts` har fortsatt `// @ts-nocheck` (ikke endret i denne runden) | Historisk mock-typer | Svakere kontrakttillit enn parity-test | Samme mønster som parity: gradvis fjerne nocheck | **No** (utenfor scope) |
| 10 | **`/api/something` eksisterer fortsatt** | Low | `app/api/something/route.ts` — nå dokumentert som demo/kontrakt | Beholdt for verktøy/referanse | Forvirring for nye utviklere | Vurder fremtidig flytt til `/_template` eller intern doc-only | **Delvis** (allerede oppdatert tekst/typer) |

---

## Ikke lenger i topp 10 (behandlet i denne runden)

- Duplikat `superadmin/.../route.ts` utenfor `app/api` (**fjernet**).
- `lint:ci` som skjuler feil (**rettet** til `next lint`).
- `@ts-nocheck` i `publicPreviewParity.test.ts` (**fjernet**).

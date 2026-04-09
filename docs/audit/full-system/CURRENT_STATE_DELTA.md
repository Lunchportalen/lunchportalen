# CURRENT_STATE_DELTA

**Branch baseline:** arbeidskopi etter CMS FASE 1–15 (se `IMPLEMENTATION_LOG.md`, `POST_IMPLEMENTATION_REVIEW.md`).  
**Re-verifisert:** 2026-03-27 (kode + kjøring av typecheck, lint, test:run; `build:enterprise` delvis — se nedenfor).

## What changed materially after the CMS refactor phases

- **Persistens, dataflyt og preview:** Save/publish, `useContentWorkspaceData`, hooks for blocks/UI/shell/overlays/AI-panel er **flyttet ut** av `ContentWorkspace.tsx` inn i dedikerte moduler (`POST_IMPLEMENTATION_REVIEW.md` dokumenterer kjeden `deriveBodyForSave` → preview, `renderPipeline`, osv.).
- **Linjetall:** `IMPLEMENTATION_LOG.md` rapporterer **6724** linjer i `ContentWorkspace.tsx` etter FASE 15; **nåværende måling** på denne maskinen: **`(Get-Content … \| Measure-Object -Line).Lines` = 6401** — avvik kan skyldes line-ending, mellomcommits eller lokal diff. **Konklusjon:** filen er **fortsatt stor**, men **ansvar er delvis modularisert** (ikke lenger «alt i én fil» for save/preview/data).
- **System motor:** Rot-`superadmin/.../route.ts` var **ikke** importet av runtime (cron bruker `app/api/superadmin/.../route.ts` via relativ sti fra `app/api/cron/`). Duplikatfila er **fjernet** i denne runden.

---

## Tabell: originale audit-funn → nåstatus

| Original finding | Current status | Evidence | Why old framing is or is not still valid |
|------------------|----------------|----------|--------------------------------------------|
| **`ContentWorkspace.tsx` ~6400+ linjer — uakseptabel monolitt** | **REDUCED** (struktur), **STILL TRUE** (volum) | `ContentWorkspace.tsx` **6401** linjer (PowerShell); `useContentWorkspacePersistence`, `useContentWorkspaceData`, `ContentWorkspaceMainCanvas`, `ContentWorkspaceEditorChrome`, m.fl. eksisterer | Gammel tekst underslår **modulær utbrytning**; **linjetall** viser fortsatt tung skallfil vs Umbraco-lignende «tynn komposisjon». |
| **`npm run build` heap OOM** | **NOT VERIFIED** denne økten | Tidligere audit: exit 134; `build:enterprise` her kompilerte ~4.4 min deretter **ENOENT** `pages-manifest.json` (se nedenfor) | Kan ikke bekrefte OOM vs andre feil uten ren `next build` + evt. `.next`-slett. |
| **`NODE_OPTIONS=8192` nødvendig** | **STILL TRUE** (prosjektdokumentasjon) | `IMPLEMENTATION_LOG.md` (flere FASE-rader): full `build:enterprise` kjørt med `--max-old-space-size=8192` | Ikke motbevist uten CI / build uten heving. |
| **Duplikat `superadmin/system/repairs/run/route.ts` utenfor `app/api`** | **RESOLVED** | Fil **slettet**; eneste HTTP+`runSystemMotor`-eksport for API/cron ligger under `app/api/superadmin/system/repairs/run/route.ts`; `app/api/cron/system-motor/route.ts` importerer `../../superadmin/system/repairs/run/route` → **resolver til `app/api/superadmin/...`** | Gammel formulering antok «to aktive HTTP-sannheter»; rotfila var **død kopi** uten imports. |
| **`app/api/something/route.ts` vag + `any`** | **REDUCED** | `app/api/something/route.ts`: kommentar om demo/kontrakt; `any` fjernet fra helpers; `SomethingFailure`-cast; ingen produkt-fetch funnet i repo | Endepunkt **finnes fortsatt** (api-contract-enforcer); nå **tydelig merket** og strengere typing. |
| **`tests/cms/publicPreviewParity.test.ts` med `@ts-nocheck`** | **RESOLVED** | `@ts-nocheck` fjernet; `MockChain`-type + `as unknown as typeof import("@/lib/supabase/admin")` på mock | Kontrakttest er **type-sjekket**; én assertiv cast for Vitest mock-grense. |
| **`lint:ci` = `next lint \|\| exit 0`** | **RESOLVED** | `package.json`: `"lint:ci": "next lint"` | Matcher `docs/RELEASE_GATE.md` / CI som bruker `npm run lint`. `lint:ci` er nå **ekte** lint (samme som `lint`). |
| **`global_content` RLS brede policies** | **STILL TRUE** (schema) + **NOT VERIFIED** (caller) | `supabase/migrations/20260421000000_global_content.sql` uendret | Krever fortsatt **caller-trace** om authenticated klient skriver direkte. |
| **`lib/ai` ~295 filer** | **STILL TRUE** | `git ls-files lib/ai` → **295** | Omfang uendret; refaktor berørte primært CMS-skall. |
| **~314 API `route.ts`** | **STALE TALL** | `git ls-files "**/route.ts"` → **324**; `api-contract-enforcer` rapporterte **557** `route.ts` (sannsynlig inkl. ikke-`app/api` eller annen telling) | Bruk **324** (git tracked `**/route.ts`) eller verifiser enforcer-logikk — ikke repeter «314» som sannhet. |
| **Preview-parity kun antatt** | **RESOLVED** som dokumentasjonskrav | `POST_IMPLEMENTATION_REVIEW.md` + tester (`publicPreviewParity.test.ts` uten nocheck) | Audit antok svakhet; refaktor **dokumenterer** pipeline eksplisitt. |

---

## Statuskoder brukt

- **RESOLVED:** Funn er adressert eller motbevist i kode.
- **REDUCED:** Strukturen er bedre; restrisiko gjenstår.
- **STILL TRUE:** Uendret problem / måling.
- **NOT VERIFIED:** Krever ny kjøring eller miljø.

---

## Build (denne økten)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (warnings) |
| `npm run test:run` | PASS (193 filer, 1133 tester) |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run build:enterprise` | **Delvis:** `next build` kompilerte; feilet ved **Collecting page data** med `ENOENT` `.next/server/pages-manifest.json` (sannsynlig Next/Windows/artefakt — **ikke** attribuert til endringene i denne runden). |

**Anbefaling:** Slett `.next` og kjør `next build` på nytt lokalt ved gjentakelse; verifiser mot CI Linux-runner.

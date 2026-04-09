# Duplicate and shadow report (V2)

**Metode:** Filnavn-kollisjoner (basename på tvers av repo), manuell verifikasjon av `tsconfig` paths, stikkprøve på `@/components`-imports, kjent Next-mønster `route.ts` × mange mapper.

## Filduplikater (samme basename, ulike stier)

**Telling:** **246** basename som forekommer mer enn én gang (ekskl. genererte mapper).  
**Mest frekvente navn:** `route.ts` (**571** forekomster — forventet for App Router API og parallel routes), `page.tsx` (**165**), `types.ts` (**43**), `engine.ts`, `index.ts`, `layout.tsx`, `actions.ts`, `run.ts`, `metrics.ts`, `README.md`, osv.

**Tolkning:** «Duplikat basename» er **ikke** automatisk feil; det er et **signal** om navigasjonskostnad og risiko for feil import.

## Mappe-duplikater (parallelle røtter)

| Mønster | Eksempel | Klassifisering |
|---------|----------|----------------|
| To komponent-røtter | `components/nav/HeaderShellView.tsx` vs `src/components/nav/HeaderShellView.tsx` | **DUPLICATE** |
| Toast | `components/ui/toast.tsx` vs `src/components/ui/toast.tsx` | **DUPLICATE** |
| Uke-widget | `components/week/WeekMenuReadOnly.tsx` vs `src/components/week/WeekMenuReadOnly.tsx` | **DUPLICATE** |
| Layout | `components/layout/PageContainer.tsx` vs `src/components/layout/PageContainer.tsx` | **DUPLICATE** |
| Design system slice | `components/ui/ds/index.ts` vs `src/components/ui/ds/*` | **DUPLICATE** / **TRANSITIONAL** |

## Alias-kollisjoner (TypeScript paths)

Fra `tsconfig.json`:

```json
"@/components/*": ["./src/components/*", "./components/*"],
"@/lib/*": ["./lib/*", "./src/lib/*"],
"@/types/*": ["./types/*", "./src/types/*"]
```

**Konsekvens:** For en import `@/components/foo/bar` vil TypeScript **foretrekke `src/components`** når filen finnes der — **skyggelegging** av `components/`.

**Klassifisering:** **SHADOWED** (sekundær mappe).

## Re-export chains (indikasjon)

- `components/ui/ds/index.ts` og `src/components/ui/ds/index.ts` — begge finnes; konsumenter bør bruke én kilde.
- `components/ai/index.ts` — senter for AI-komponenter; kryssimport til blocks.

Full graf er **ikke** maskinelt traversert i V2 (anbefales som oppfølging med `madge` eller `ts-prune`).

## Shadowed component roots

| Root | Skygges av | Bevis |
|------|------------|-------|
| `./components/*` | `./src/components/*` | `tsconfig` path order |

## Duplicate route surfaces

| Mønster | Eksempel | Klassifisering |
|---------|----------|----------------|
| ESG summary | `app/api/admin/esg/summary`, `app/api/backoffice/esg/summary`, `app/api/superadmin/esg/summary` | **DUPLICATE** API-yte (roller/bruksområde varierer) |
| ESG latest-monthly | `app/api/backoffice/esg/latest-monthly` vs `app/api/superadmin/esg/latest-monthly` | **DUPLICATE** |
| Ordre cancel | `lib/system/routeRegistry.ts` noterer bl.a. legacy vs canonical cancel paths | **TRANSITIONAL** ( dokumentert i registry ) |
| «Something» demo | `app/api/something/route.ts` | **ACTIVE** for kontrakt/verktøy; ikke produktflate |

## Duplicate docs

| Område | Observasjon |
|--------|-------------|
| `docs/hardening/*` vs `docs/phase2*/*` vs `docs/audit/full-system/*` | Overlappende «source of truth»-beskrivelser — klassifiser per `DOCS_DRIFT_REPORT.md`. |
| Rot-`.md` policyfiler vs `docs/` | Mange parallelle policy-/GRC-dokumenter. |

## Duplicate social / seo / esg / cms flows

| Flow | Duplikat-indikasjon |
|------|---------------------|
| **Social** | `app/api/social/**` (mange endepunkter) + `app/(backoffice)/backoffice/social` + `app/superadmin/growth/social` — **flere innganger** til «growth». |
| **SEO** | `app/(backoffice)/backoffice/seo-growth` + `lib/ai` SEO-verktøy + `scripts/seo-*.mjs` — **kanonisk UI** vs **batch** må holdes adskilt. |
| **ESG** | Trippel API-lag (admin/backoffice/superadmin) + `app/api/cron/esg/*` — **DUPLICATE** yte, muligens bevisst rolle-separasjon. |
| **CMS** | `app/(backoffice)/backoffice/content` + `lib/cms` + `app/api/backoffice/content` — **CANONICAL** kjedel, men stor overflate. |

## Anbefaling (ingen flytting nå)

1. **Frys** nye parallelle rotmapper til `@/components` er enighet.  
2. **Kartlegg** faktiske import-pekere med verktøy (`grep` / depcruise) før merge av mapper.  
3. **API:** dokumenter «owner» per rute (delvis gjort i `ROUTE_REGISTRY`).

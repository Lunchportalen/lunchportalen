# Orphan and dead code report (V2)

**Metode:** Statisk heuristikk (filnavn, grep-nøkkelord, kjente stub-mønstre), **ikke** full dead-code elimination.  
**Sannhet:** Noe kan være «dødt» i produksjon men brukt av cron/CI — **NEEDS_REVERIFICATION**.

## Orphan files (kandidater)

| Filsti / mønster | Signal | Klassifisering |
|------------------|--------|----------------|
| `app/registrering/page.duplicate.tsx` | Navn inneholder `duplicate` | **ORPHAN** / **NEEDS_REVERIFICATION** |
| Rot: `dead-files.json`, `fullAudit.json`, `prioritizedTasks.json`, `queue.json` | Genererte/artifakt-lignende | **OPS_RISK** — ikke klart runtime |
| `app/api/something/route.ts` | Kommentar: contract smoke, ikke produkt-kallere | **ACTIVE** for tooling — **ORPHAN** for produkt |

## Orphan routes (heuristikk)

- **Cron-ruter** som **ikke** er i `vercel.json` `crons` kan være **manuelle** eller **døde** — se `CRON_WORKER_AND_OUTBOX_REPORT.md`.
- **Store** `app/api/**` flater (500+ `route.ts`) — mange sannsynlige **internal/experiment** — krever eierskap-register.

## Unused docs / tests

| Type | Observasjon |
|------|-------------|
| **Dokumentasjon** | `docs/audit/full-system/**` kan være **SUPERSEDED** av nyere faser — ikke «unused», men **DOC_DRIFT**. |
| **Tester** | `npm run test:run` pass **212** filer / **1191** tester — ikke indikasjon på «unused tests», men **noen** tester kan være **smoke** som ikke dekker alle ruter. |

## Dead scripts

| Script | Status |
|--------|--------|
| `npm run worker:queue` | **ACTIVE** — Redis worker |
| `npm run build:enterprise` | **ACTIVE** — CI gate |
| `npm run audit:full` | Krever manuell bruk — **ACTIVE** |

**Dead:** ingen enkelt script markert som «fjern» uten eier — **NEEDS_REVERIFICATION**.

## Dead cron-routes

- **56+** filer under `app/api/cron/**` (én `route.ts` per undermappe i skanning).
- **9** `vercel.json` crons — **gap** = **mange** cron-paths ikke schedulert på Vercel (kan være **manuell**, **deprecated**, eller **annen** scheduler).

## Dead workers

| Worker | Funn |
|--------|------|
| `workers/worker.ts` | Jobber `send_email`, `ai_generate`, `experiment_run` logger **stub** — **DEAD_CODE** inntil implementert. |
| `retry_outbox` | **ACTIVE** — kaller `/api/cron/outbox` med hemmelighet |

## Deprecated stubs

| Lokasjon | Tekst / mønster |
|----------|-----------------|
| `lib/auth/routeByUser.ts` | «Legacy fallback: user-only routing» |
| `lib/system/routeRegistry.ts` | `standard: "legacy"` for enkelte ruter |
| `studio/lunchportalen-studio/DEPRECATED.md` | Eksplisitt deprecated-notat |

## Placeholder routes

| Rute | Formål |
|------|--------|
| `app/api/something/route.ts` | Kontrakt smoke / internt demo — **PLACEHOLDER**-aktig, men **hardened** (cron/superadmin) |

## Duplicate APIs (kort)

Se `DUPLICATE_AND_SHADOW_REPORT.md` — ESG og flere «growth»-endepunkter.

## Konklusjon

**Orphan/dead** er **ikke** tallfestet på 100% uten import-graph. **Høyeste risiko:** (1) **API-sprawl**, (2) **cron uten** Vercel-schedule, (3) **worker stub-jobs**.

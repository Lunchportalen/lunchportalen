# Go-live risk register V2

**Dato:** 2026-03-29  
**Kontekst:** RC / pilot-forberedelse — ikke en formell sertifisering.

## Risikoer (kompakt)

| ID | Risiko | Kategori | Alvor | Status |
|----|--------|----------|-------|--------|
| R1 | **API surface** (~561 `route.ts`) — vanskelig å garantere full gating | SECURITY_RISK / SCALE_RISK | Høy | **STILL_OPEN_FROM_BASELINE** |
| R2 | **Middleware** sjekker ikke rolle — kun cookie for beskyttede **sider** | SECURITY_RISK | Middels | **STILL_OPEN_FROM_BASELINE** (kjent; API må enforce) |
| R3 | **`strict: false`** i TypeScript | SCALE_RISK / kvalitet | Middels | **STILL_OPEN_FROM_BASELINE** |
| R4 | **Cron-sprawl** — mange `app/api/cron/*` uten Vercel schedule | OPS_RISK | Middels | **NEW_RISK** |
| R5 | **Worker stub-jobs** (e-post, AI, eksperiment) | OPS_RISK | Lav–middels | **STILL_OPEN_FROM_BASELINE** |
| R6 | **Dobbelt component root** (`src/components` skygger `components`) | SCALE_RISK | Middels | **NEW_RISK** |
| R7 | **Trippel ESG API** (admin/backoffice/superadmin) | SECURITY_RISK / forvirring | Middels | **DUPLICATE** |
| R8 | **Dokumentasjon spredt** (rot vs `docs/`) | DOC_DRIFT | Lav | **STILL_OPEN** |
| R9 | **Growth/AI «motor»** ved siden av kjerne | Produkt / sikkerhet | Variabel | **TRANSITIONAL** |
| R10 | **Outbox/worker** avhenger av Redis + secrets — feilkonfig gir stille etterslep | OPS_RISK | Middels | **NEEDS_REVERIFICATION** |

## Pilot blockers (egen liste — utdrag)

### Må lukkes før pilot (streng tolkning — team må avklare)

- **Ingen automatisert «blocker»** fra denne audit: `typecheck`, `build:enterprise`, `test:run` **PASS** lokalt 2026-03-29.
- **Menneskelig / prosess:** Rolle-godkjenning av **hvilke** API-ruter som faktisk skal være live i pilot.

### Bør lukkes før bred live

- Reduksjon eller **eierskap** på **cron** og **API**-liste.
- **Strict** TypeScript (gradvis).
- Ferdigstille **worker**-jobber som er **stub**.

### Kan vente

- Konsolidering av **dokumentrot**.
- Sammenslåing av **duplikate** komponent-filer (etter policy).

## Referanser

- `docs/hardening/OPEN_PLATFORM_RISKS.md`
- `API_SURFACE_AND_GATING_REPORT.md`
- `CRON_WORKER_AND_OUTBOX_REPORT.md`

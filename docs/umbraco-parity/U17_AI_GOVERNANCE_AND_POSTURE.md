# U17 — AI governance and posture

## Umbraco AI-prinsipper (operativ tolkning)

| Prinsipp | Lunchportalen |
|----------|----------------|
| CMS stabil, AI fleksibel | Runtime uendret; AI foreslår, forklarer — publiserer ikke ordre/agreement |
| Modulær | `app/api/backoffice/ai/**` — egne endepunkter |
| Valgfri | Ingen tvang for redigering |
| Kontroll (modell/tone) | Prompt/policy i kode + env |
| Human approval | Content workflow, review |
| Data governance | Ingen antatt modelltrening på kundedata |
| Forutsigbar kost | Operativt — ikke full CMS-dashboard |
| Ingen vendor lock | `check:ai-internal-provider`, leverandør via env |

## Modenhet (kort)

- **Moden:** tekst/layout/SEO/bilde-hjelp i content workspace.
- **LIMITED / DRY_RUN / STUB:** social publish, worker-jobs (jf. `MODULE_LIVE_POSTURE_REGISTRY`).

## U17 DEEP

- Manifest (`nav.ai-tower`) peker på `modulePostureId: worker_jobs` — **ærlig** om jobb-lag.
- Ingen ny orchestrator.

## Bredere enn standard Umbraco (der trygt)

- CRO, SEO, media, forklarende strips — så lenge backend og posture støtter.

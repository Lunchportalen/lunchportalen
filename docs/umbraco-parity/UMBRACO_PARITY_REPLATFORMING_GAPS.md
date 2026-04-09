# Umbraco parity — replatforming gaps (ærlig)

## Krav som *ikke* blir 100 % Umbraco-lignende på dagens stack uten replatforming

| Krav | Hvorfor ikke full paritet | Forsvarlig simulering på dagens stack |
|------|---------------------------|--------------------------------------|
| Én CMS-kjerne (.NET Content Service) for alt innhold | Stack er Next + Sanity + Postgres | **Control plane** + tydelig dokumentasjon av dual source |
| Én samlende bruker-/rollemodell i én backoffice | `superadmin` ≠ `company_admin` ulike apper | **Routing + domain surfaces** + ærlig «hvor du endrer» |
| Innebygd Umbraco Forms / Workflow engine | Eget økosystem | Eksisterende workflow + API-gates |
| Native Umbraco Media som eneste DAM | Vi har hybrid media | **Backoffice media** + Sanity assets der relevant |
| Single deployment package som Umbraco Cloud | Vercel/Node | CI/CD som i repo — dokumentert |

## Kan løses med UX/flow-paritet (anbefalt)

- **Sections/dashboards** — allerede `BackofficeShell`; kan styrkes uten ny backend.
- **Publish** — to kilder (Postgres vs Sanity) — **seksjoner** og **tydelige CTA-er** reduserer «fragmentert» følelse.
- **History/rollback** — vise det som *finnes* (page recovery / Sanity history links) uten å late som det er én motor.

## Bør ikke «simuleres» med falsk teknikk

- **Fake** én database for alt innhold.
- **Skjule** LIMITED/DRY_RUN som LIVE.

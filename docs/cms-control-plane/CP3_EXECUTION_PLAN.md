# CP3 — Execution plan (CMS Control Plane Domain Orchestration)

**Dato:** 2026-03-29  
**Mål:** Flytte fra «CMS-led but fragmented» til «CMS-led and enterprise-coherent» via **runtime-broer** (lesing, navigasjon, ærlig status) — **ikke** nye parallelle systemer.

## Prinsipper (låst)

- **CMS Control Plane** eier: innholdstre, design/media, publiseringskontroll, uke/meny-**styring i forhold til eksisterende kilder**, review, tårn-shells, SEO/social/ESG-**presentasjon**, runtime-status og trygg routing til operative handlinger.
- **Operational Runtime Truth** eier: auth/session, ordrehendelser, fakturagrunnlag, leveranse, audit, cron-aggregater.
- **Ingen** ny transaksjonell sannhet i CMS uten at det er direkte nødvendig og trygt.

## Arbeidsstrømmer

| # | Arbeidsstrøm | Leveranse (dok) | Kodefokus |
|---|----------------|-----------------|-----------|
| 1 | Company / customer / agreement / location surfaces | `CMS_COMPANY_CUSTOMER_AGREEMENT_LOCATION_RUNTIME.md` | `loadDomainRuntimeOverview`, `/backoffice/domains`, `/backoffice/customers`, panel |
| 2 | Week / menu / publish governance | `CMS_WEEK_MENU_RUNTIME_IMPLEMENTATION.md`, `CMS_WEEK_MENU_PUBLISH_CHAIN.md` | `/backoffice/week-menu`, `CmsWeekRuntimeStatusPanel` |
| 3 | Control towers as domain modules | `CMS_CONTROL_TOWERS_RUNTIME_ALIGNMENT.md` | `TopBar`, `control/page`, domeneindeks |
| 4 | Growth modules (social / SEO / ESG) | `CMS_GROWTH_MODULE_RUNTIME_ALIGNMENT.md` | Eksisterende moduler + felles status (`CONTROL_PLANE_RUNTIME_MODULES`) |
| 5 | Enterprise hardening (CP3) | `CMS_ENTERPRISE_HARDENING_CP3.md` | Fail-closed der hull; små grep |
| 6 | Verifikasjon | `CMS_CONTROL_PLANE_VERIFICATION.md` | typecheck, build:enterprise, test:run |

## Avsluttende artefakter

- `CP3_DECISION.md`, `CP3_TRAFFIC_LIGHT_MATRIX.md`, `CP3_SIGNOFF.md`, `CP3_OPEN_RISKS.md`, `CP3_NEXT_STEPS.md`
- `CP3_CHANGED_FILES.md`, `CP3_EXECUTION_LOG.md`

## Stoppregel

Ingen nye produktfaser eller store refaktorer uten eksplisitt instruks etter CP3.

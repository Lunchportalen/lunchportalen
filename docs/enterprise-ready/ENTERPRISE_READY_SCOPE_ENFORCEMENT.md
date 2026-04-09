# E0 — Scope enforcement (klassifisering for ubetinget enterprise-live)

**Dato:** 2026-03-29  
**Klasser:** `ENTERPRISE_LIVE` | `BROAD_LIVE_LIMITED` | `PILOT_ONLY` | `DRY_RUN` | `STUB` | `DISABLE_FOR_ENTERPRISE_LIVE`

| Område | Klasse | Merknad |
|--------|--------|---------|
| Employee week | **BROAD_LIVE_LIMITED** | Kjerne runtime; B1 gjør «enterprise» begrenset uten arkitektur-lukking |
| Onboarding | **ENTERPRISE_LIVE** (flyt frosset) | Policy: ikke endret i E0 |
| Order / window | **ENTERPRISE_LIVE** (kjerne) | API testet; vindu-sannhet miljøavhengig |
| Billing | **BROAD_LIVE_LIMITED** | Hybrid; økonomi-QA ikke fullt bevist i repo |
| Company admin | **ENTERPRISE_LIVE** | Scope-mønster |
| Kitchen | **ENTERPRISE_LIVE** | Read-only sannhet |
| Driver | **ENTERPRISE_LIVE** | Scope-mønster |
| Superadmin | **BROAD_LIVE_LIMITED** | Høy makt; prosessavhengig |
| Social calendar | **ENTERPRISE_LIVE** (intern DB) | |
| Social publish | **DRY_RUN** / **BROAD_LIVE_LIMITED** | Ekstern effekt ikke garantert |
| SEO growth | **BROAD_LIVE_LIMITED** | Review-first |
| ESG | **BROAD_LIVE_LIMITED** | Data/kommunikasjon; tom data |
| Cron / jobs (Vercel-liste) | **ENTERPRISE_LIVE** | Med secrets; jf. `vercel.json` |
| Worker | **STUB** (delvis) + **ENTERPRISE_LIVE** (kun `retry_outbox`) | Stubs **ikke** enterprise-live som produkt |
| Admin/backoffice content publish | **ENTERPRISE_LIVE** (med rolle) | Kompleksitet → LIMITED ved feil bruk |
| Media | **ENTERPRISE_LIVE** | |
| Content tree | **ENTERPRISE_LIVE** | |
| Observability | **BROAD_LIVE_LIMITED** | Ikke full plattform-SLA |
| Backup/restore | **BROAD_LIVE_LIMITED** | Leverandør-prosess; ikke bevist i repo |
| Support runbook | **BROAD_LIVE_LIMITED** | Dokumentert; menneskeavhengig |
| Scale readiness | **PILOT_ONLY** / **STUB** (bevismessig) | Ingen lasttest-bevis |

**For ubitinget enterprise-live** kreves at **ingen** kritisk flate er DRY_RUN/STUB/PILOT_ONLY — derfor **NO-GO** samlet.

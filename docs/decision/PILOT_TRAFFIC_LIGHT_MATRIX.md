# Pilot traffic light matrix (G0)

**Dato:** 2026-03-29  
**Skala:** GREEN = akseptabel for pilot · YELLOW = akseptabel kun med begrensning/oppfølging · RED = ikke akseptabel som standard pilot

| # | Kategori | Status | Evidence | Why | Required action |
|---|----------|--------|------------|-----|-----------------|
| 1 | Access & security | **YELLOW** | `middleware.ts` (cookie, ikke rolle); `lib/http/routeGuard.ts`; `OPEN_PLATFORM_RISKS` A1–A2 | Sider beskyttet; API må selv enforce — stor flate. | Scope lock + stikkprøver; briefing om API-sannhet. |
| 2 | Role enforcement | **YELLOW** | `scopeOr401`/`requireRoleOr403` mønster; `DELTA` §5 | Roller håndheves i API/layout, ikke i middleware. | Ikke forvent rolle fra middleware; verifiser kritiske ruter i pilot. |
| 3 | Employee Week safety | **YELLOW** | `lib/week/availability.ts` (15:00); `allowNextForRole` | Baseline-lukker bekreftet; to spor ukeplan fortsatt åpent. | E2E QA tor/fred/lørdag; aksepter eller mitiger «to spor». |
| 4 | Onboarding / activation safety | **YELLOW** | Frosen flyt i policy; `GO_LIVE` §1–2 | Ikke endret i G0; avhenger av miljø-QA. | Manuell stikkprøve i staging; ingen scope-endring i pilot uten vedtak. |
| 5 | Billing / invoicing safety | **YELLOW** | `OPEN_PLATFORM_RISKS` C1–C2; ikke full økonomi-audit i G0 | Hybrid Stripe/faktura — operativ risiko. | Begrens pilot til avtalt fakturascenario; ikke «full økonomi» uten QA. |
| 6 | Content / publish safety | **YELLOW** | CMS API + tester; `GO_LIVE` §3 | Workflow finnes; menneskelig feil mulig. | Én røyktest publish/rollback i pilot-miljø. |
| 7 | CMS / backoffice stability | **YELLOW** | `FULL_REPO_AUDIT_V2` stor flate; mange tester | Kompleksitet + alias `src/components` først. | Superadmin-only der definert; ikke aktiver nye eksperimentelle AI-ruter i pilot uten review. |
| 8 | Company admin runtime | **YELLOW** | `app/admin/**`; tenant-tester | Stabil mønster; avhenger av scope. | Stikkprøve invites/agreement på pilot-tenant. |
| 9 | Kitchen runtime | **YELLOW** | `app/kitchen/**`; kitchen-tester | Read-only produksjon — policy; teknisk OK med guard. | Verifiser scope for pilot-kjøkken-lokasjon. |
| 10 | Driver runtime | **YELLOW** | `app/driver/**`; driver-tester | Mobil kritisk — S1 i policy. | Manuell mobil-smoke på pilot. |
| 11 | Superadmin runtime | **YELLOW** | Stor flate; `capabilities` | Høy makt — feil klikk har stor radius. | Begrens hvem som har superadmin i pilot. |
| 12 | Social calendar runtime | **YELLOW** | `social_posts`; publish **dry_run** mulig | D1 — ekstern sannhet ikke garantert. | Signer av på «dry_run OK»; ikke mål ekstern reach. |
| 13 | SEO runtime | **YELLOW** | `build:enterprise` SEO gates; backoffice SEO | D2 — review-first; avhenger av disiplin. | Ingen SEO som løfte uten publish-flyt demonstrert. |
| 14 | ESG runtime | **YELLOW** | Trippel API; `OPEN_PLATFORM_RISKS` D3–D4 | Tom data / tolkning — marked risiko. | Juridisk/marked: ikke over-selg tall; bruk riktig API etter rolle. |
| 15 | Cron / worker / outbox | **YELLOW** | `vercel.json` 9 schedules; `lib/pilot/vercelScheduledCrons.ts`; worker stubs | R4–R5; mange cron-filer utenom schedule. | Verifiser secrets; overvåk `cronRecentFailures`; ikke avhenger av stub-jobs. |
| 16 | Observability / alerting | **YELLOW** | `GET /api/observability`; `cron_runs`; ingen PagerDuty i repo | Minimum finnes; ikke 24/7 enterprise alerting. | Avtalt vakt/oppfølging; sjekk superadmin system. |
| 17 | Backup / restore | **YELLOW** | `H2_RUNBOOK` — Supabase sannhet | Ingen app-builtin restore. | Eier navngitt; PITR/snapshot kjent — ellers dokumentert risiko. |
| 18 | Operational runbook | **YELLOW** | `H2_RUNBOOK_AND_RECOVERY.md`, `GO_LIVE` §11 | Delvis; support 1-siders ikke alle laget. | Minimum eskalering + runbook lest før start. |
| 19 | Performance / scale confidence | **YELLOW** | `OPEN_PLATFORM_RISKS` F1–F2 | Ingen dokumentert lasttest. | Lav trafikk antatt; avtal terskel for eskalering. |
| 20 | Pilot support readiness | **YELLOW** | Sjekklister finnes; utfylling manuell | Avhenger av mennesker. | Navngitt support + superadmin-kontakt. |

**Oppsummert:** Ingen kategori er **RED** på rent teknisk grunnlag gitt **GO WITH CONDITIONS**; ingen er **GREEN** uten forbehold — pilot krever **begrenset scope** og **aksept**.

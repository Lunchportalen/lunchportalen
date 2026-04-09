# E0 — Ops & support closure (arbeidsstrøm 4)

**Dato:** 2026-03-29

## 5xx / hendelser

- Helse-API returnerer **ikke** «fake OK» når DB/env feiler — testet (`tests/api/healthPublic.test.ts` m.fl.).
- Strukturert logging (`lp.observability.event`, incidents) på mange API-er.

## Cron-feil

- `cron_runs` / outbox-mønstre dokumentert i H2; tester for outbox-auth og observability.

## Social / SEO / ESG-feil

- API returnerer kontraktsmessige feil; full paging/alerting-SLA er **ikke** bevist i repo.

## Backup / restore

- Avhenger av Supabase/leverandør — **DOC_ONLY** evidence i kodebase (`ENTERPRISE_READY_EVIDENCE_MAP.md`).

## Rollback

- Beskrevet i `docs/live-ready/LIVE_READY_RUNBOOK.md` / hardening runbooks — **prosess**, ikke automatisk bevist.

## Support / eskalering

- `LIVE_READY_SUPPORT_MODEL.md` — roller må være navngitt i org; **ikke** verifisert i E0.

## Konklusjon

Drift kan **ikke** hevdes som «enterprise-SLA lukket» uten organisatorisk bevis → bidrar til **NO-GO** for ubetinget status.

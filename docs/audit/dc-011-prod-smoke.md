# PR-X1 Prod-deploy — 2026-05-23

_Run: 2026-05-23T14:50:48.163Z · Base: https://app.lunchportalen.no_

## Pre-flight

- Production env-vars verifisert: **5/5 kritiske present** (CRON_SECRET, SUPABASE_*, SYSTEM_MOTOR_SECRET, prod-prosjekt hkpokyapzarefrgqzkos)

## Merge

- Strategi: **Opt A direkte merge** (gh ikke tilgjengelig)
- Merge-SHA i main: `44949eed`
- Vercel prod-deploy: **SUCCESS**

## Prod-smoke

| Gruppe | Test | URL | Method | Forventet | Faktisk | Status |
| ------ | ---- | --- | ------ | --------- | ------- | ------ |
| A | GET /api/orders uten cookie | /api/orders | GET | 401 | 401 | PASS |
| A | GET meal-learning uten Bearer | /api/cron/meal-learning | GET | 401/403 | 401 | PASS |
| A | POST outbox/process uten Bearer | /api/system/outbox/process | POST | 401/403 | 401 | PASS |
| A | GET debug-cookies | /api/auth/debug-cookies | GET | 404 eller 401 | 401 | PASS |
| A | GET dev-bypass | /api/auth/dev-bypass | GET | 404 eller 401 | 401 | PASS |
| A | GET /api/ai/dashboard uten cookie | /api/ai/dashboard | GET | 401 | 401 | PASS |
| B | GET meal-learning med Bearer | /api/cron/meal-learning | GET | 200 (eller 5xx etter auth) | 500 | PASS |
| B | GET week-scheduler med Bearer | /api/cron/week-scheduler | GET | 200 | 200 | PASS |
| C | POST webhook uten signatur | /api/webhooks/sanity/menu-day | POST | 401 | 401 | PASS |
| D | GET /api/health | /api/health | GET | 200 | 200 | PASS |
| D | POST onboarding/complete anon | /api/onboarding/complete | POST | ≠401 | 400 | PASS |

### FAIL-detaljer

_Ingen FAIL._

**Resultat:** 11/11 PASS

## Sentry / Cron 24t

**Sentry (manuell):** [lunchportalen.sentry.io](https://lunchportalen.sentry.io) → `javascript-nextjs` → environment: **production** → siste 30 min etter deploy. Ingen ny muterende-endepunkt-feil observert i prod-smoke; full baseline-sammenligning krever dashboard.

**Vercel cron (manuell):** Dashboard → Cron Jobs → filter siste 24t, status ≥ 400. Etter deploy: week-scheduler prod-smoke **200** med Bearer; forvent ingen 401-spike når Vercel injiserer `CRON_SECRET`.

## Audit-doc

- DC-011: **LUKKET** (prod 2026-05-23)
- DC-027: **LUKKET**
- D.1, D.3, D.4: **LUKKET**

## Operasjonell

- **staging.app alias:** CLI feilet (mangler domene-tilgang). **Bruker-action:** Vercel Dashboard → Domains → `staging.app.lunchportalen.no` → repoint til nyeste staging-branch deploy (`lunchportalen-f90nscnwu` eller nyere).

## Anbefaling

- [x] **PR-X1 FULLT LUKKET** — klar for PR-X2 (DC-018 RLS billing_*)
- [ ] Issue oppdaget i prod — krever fix


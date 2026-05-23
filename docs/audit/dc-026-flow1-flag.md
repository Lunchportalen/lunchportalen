# PR-X4 DC-026 Tripletex Flow 1 flag — 2026-05-23

## Discovery
- Flow 1 entry points: **7** (cron 2 route + 1 mixed worker, api 1, lib 3)
- Flow 2 entry points: **bekreftet upåvirket** (connection-health, agreements-daily, provider-scoped outbox handlers)
- Implicit default lokasjon: `lib/integrations/tripletex/client.ts:323-353` (`loadConfig`), `:463-472` (`loadLpCredentials`)

## Implementation
- Helper: `lib/server/config/featureFlags.ts` (`isTripletexFlow1Enabled`, `Flow1DisabledError`)
- Gated routes:
  - `app/api/cron/tripletex-saas-monthly/route.ts` — full skip
  - `app/api/system/outbox/process/route.ts` — Flow 1 batches skipped
  - `app/api/tripletex/prod-verify/route.ts` — 503
  - `lib/integrations/tripletex/client.ts` — LP auth path in `resolveTripletexAuth`
  - `providerSaasInvoiceSync.ts`, `providerCustomerSync.ts` — lib throw
- New tests: **13** (featureFlags 9 incl. test.each, flow1Gate 3, saas-monthly skip 1)
- Existing tests updated: **5** (tripletexClientAuth, providerSaas*, requestTripletex.parameterAuth)

## Test-suite
- Before: 2387 PASS
- After: **2403 PASS**, 0 FAIL

## Staging-smoke
| Kategori | Forvent | Faktisk |
|----------|---------|---------|
| Flow 1 cron | 200+skipped | ⚠ Deploy klar (`9d36fd21`); Vercel Deployment Protection blokkerer ekstern curl uten bypass-token |
| Flow 1 API | 503 | ⚠ Ikke kjørt (samme protection) |
| Flow 2 cron | 200 normal | ⚠ Ikke kjørt (samme protection) |

Staging deploy: `lunchportalen-lpa6im8sf` (Ready). Bruk `VERCEL_AUTOMATION_BYPASS_SECRET` + git-staging URL for manuell verifikasjon.

## Prod-smoke
| Kategori | Forvent | Faktisk |
|----------|---------|---------|
| Flow 1 cron saas-monthly | 200+skipped | ✓ `FLOW1_DISABLED` |
| Flow 1 cron tripletex-outbox | 200+Flow1 batches skipped | ✓ `invoiceReady.skipped=FLOW1_DISABLED` |
| Flow 2 cron connection-health | 200 normal | ✓ `ok=true`, ikke skipped |
| Flow 1 API prod-verify | 503 (auth) / fail-closed | ✓ 401 UNAUTHENTICATED (auth før flag — fail-closed) |

Prod deploy SHA: `b2b0e55b` (merge PR-X4), Vercel prod Ready 2026-05-23 17:53 CET.

## Vercel env pre-flight
- `TRIPLETEX_FLOW_1_ENABLED`: **ikke satt** i preview/production (verifisert via `vercel env ls`)

## Anbefaling
- [x] PR-X4 LUKKET — DC-026 fail-closed; Flow 2 isolert i tester og prod-smoke
- [ ] Klar for DC-013 quick win eller K6 LIVE-runde

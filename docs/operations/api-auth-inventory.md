# API auth inventory (canonical)

**Tidsstempel:** 2026-05-23T11:39:40.084Z · **Oppdatert PR-X1 Fase 3:** 2026-05-23  
**Metode:** Fase 1 + batch B1–B9, B3a/b/c wrapper-auth B8 (`scripts/audit/dc-011-route-inventory.mjs`)  
**Status:** **LUKKET (PR-X1 Fase 3)** — middleware restaurert, 33 rute-fixes, allowlist **81**.

> **Canonical path:** `docs/operations/api-auth-inventory.md`  
> Tidligere: `docs/audit/dc-011-route-inventory.md`

## 🚨 KRITISKE FUNN — LUKKET (PR-X1 Fase 3)

Alle 23 oppføringer under er adressert i Fase 3 (session/cron/superadmin/zod+rate-limit/env-gate). Se `lib/server/auth/apiAllowlist.ts` og regresjonstester i `tests/security/`.

- `/api/ai/analyze` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/analyze/route.ts:5)
- `/api/ai/continue` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/continue/route.ts:3)
- `/api/ai/copilot` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/copilot/route.ts:3)
- `/api/ai/dashboard` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/dashboard/route.ts:4)
- `/api/ai/decision` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/decision/route.ts:4)
- `/api/ai/design/analyze` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/design/analyze/route.ts:3)
- `/api/ai/design/generate` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/design/generate/route.ts:4)
- `/api/ai/growth/ads` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/growth/ads/route.ts:3)
- `/api/ai/growth/funnel` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/growth/funnel/route.ts:3)
- `/api/ai/growth/seo` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/growth/seo/route.ts:3)
- `/api/ai/inline` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/inline/route.ts:4)
- `/api/ai/insights` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/insights/route.ts:3)
- `/api/ai/learn` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/learn/route.ts:3)
- `/api/ai/page/audit` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/page/audit/route.ts:4)
- `/api/ai/rewrite` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/rewrite/route.ts:3)
- `/api/backoffice/experiments/event` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/backoffice/experiments/event/route.ts:5)
- `/api/public/ai-demo-cta/assign` — B3c supabaseAdmin HTTP uten beskyttelse (app/api/public/ai-demo-cta/assign/route.ts:97)
- `/api/public/demo-interest` — B3c supabaseAdmin HTTP uten beskyttelse (app/api/public/demo-interest/route.ts:51)
- `/api/public/forms/[id]/schema` — B3c supabaseAdmin HTTP uten beskyttelse (app/api/public/forms/[id]/schema/route.ts:13)
- `/api/public/search` — B3c supabaseAdmin HTTP uten beskyttelse (app/api/public/search/route.ts:33)
- `/api/public/track-event` — B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/public/track-event/route.ts:8)
- `/api/superadmin/users/set-company-admin` — B3c supabaseAdmin HTTP uten beskyttelse (app/api/superadmin/users/set-company-admin/route.ts:20)
- `/api/system/outbox/process` — B3c supabaseAdmin HTTP uten beskyttelse (app/api/system/outbox/process/route.ts:9)

## Sammendrag

| Metrikk | Verdi |
| ------- | ----: |
| Totalt ruter | 536 |
| Endelig allowlist (Seksjon A) | 83 |
| Fase 2-D fix-required | 10 |
| UKLART-REVIEW (Seksjon C) | 12 |
| Dekket-liste (Seksjon B) | 420 |

### Fase 2 → Fase 2.5 delta

| Kategori | Fase 2 | Fase 2.5 | Endring (årsak) |
| -------- | -----: | -------: | --------------- |
| session | 42 | 45 | +B1, +B8-session |
| role-check | 375 | 375 | +B2, +B8-role |
| cron-secret | 32 | 32 | uendret |
| webhook-sig | 3 | 3 | uendret |
| anon-allowed | 27 | 45 | +B3a |
| api-key | 0 | 1 | +B9 (ny) |
| service-role | 0 | 0 | +B3b (ny) |
| UKLART-REVIEW | 29 | 12 | bør krympe |
| FASE-2D | 32 | 10 | bør krympe til ≤10 |
| **Total** | 536 | **536** | |

## Wrapper-auth-katalog

| Wrapper | Definisjonsfil | Auth-mekanisme | Antall ruter | Status |
| ------- | -------------- | -------------- | -----------: | ------ |
| `getScope` | `lib/auth/scope.ts:7` | session | 3 | VERIFISERT-AUTH |
| `getTenantContext` | `lib/api/guard.ts:3` | api-key | 1 | VERIFISERT-AUTH |
| `requireApiKey` | `lib/api/guard.ts:3` | api-key | 0 | VERIFISERT-AUTH |
| `superadminControlTowerJsonGet` | `lib/http/superadminControlTowerGet.ts:6` | session | 3 | VERIFISERT-AUTH |
| `withAiDecisionEntrypoint` | `lib/ai/aiEntrypointContext.ts:8` | — | 0 | 🚨 IKKE-AUTH |
| `withApiAiEntrypoint` | `lib/http/withApiAiEntrypoint.ts:10` | — | 117 | 🚨 IKKE-AUTH |
| `withRole` | `lib/http/withRole.ts:8` | session | 0 | VERIFISERT-AUTH |

## Seksjon A — ENDELIG ALLOWLIST

**83 ruter** — fail-closed cron/webhook, anon (a)–(d), eller api-key. Kilde: `lib/server/auth/apiAllowlist.ts`.

### A.1 — cron-secret

| URL | Methods | Bevis (fil:linje) | Rasjonale |
| --- | ------- | ----------------- | --------- |
| `/api/cron/ai-experiment-generator` | POST | requireCronAuth (app/api/cron/ai-experiment-generator/route.ts:8) | fail-closed: requireCronAuth |
| `/api/cron/autopilot` | GET | requireCronAuth (app/api/cron/autopilot/route.ts:10) | fail-closed: requireCronAuth |
| `/api/cron/business` | GET, POST | requireCronAuth (app/api/cron/business/route.ts:8) | fail-closed: requireCronAuth |
| `/api/cron/check-deviations` | GET, POST | requireCronAuth (app/api/cron/check-deviations/route.ts:7) | fail-closed: requireCronAuth |
| `/api/cron/cleanup-invites` | POST | requireCronAuth (app/api/cron/cleanup-invites/route.ts:6) | fail-closed: requireCronAuth |
| `/api/cron/daily-order-summary` | POST | requireCronAuth (app/api/cron/daily-order-summary/route.ts:7) | fail-closed: requireCronAuth |
| `/api/cron/daily-sanity` | GET | requireCronAuth (app/api/cron/daily-sanity/route.ts:17) | fail-closed: requireCronAuth |
| `/api/cron/experiments` | POST | requireCronAuth (app/api/cron/experiments/route.ts:9) | fail-closed: requireCronAuth |
| `/api/cron/forecast` | GET | requireCronAuth (app/api/cron/forecast/route.ts:6) | fail-closed: requireCronAuth |
| `/api/cron/global-learning` | POST | requireCronAuth (app/api/cron/global-learning/route.ts:8) | fail-closed: requireCronAuth |
| `/api/cron/invoices/generate` | GET | requireCronAuth (app/api/cron/invoices/generate/route.ts:11) | fail-closed: requireCronAuth |
| `/api/cron/kitchen-print` | GET | requireCronAuth (app/api/cron/kitchen-print/route.ts:9) | fail-closed: requireCronAuth |
| `/api/cron/meal-learning` | GET | requireCronAuth (app/api/cron/meal-learning/route.ts:142) | fail-closed: requireCronAuth |
| `/api/cron/menu-service-day-reconcile` | GET | requireCronAuth (app/api/cron/menu-service-day-reconcile/route.ts:9) | fail-closed: requireCronAuth |
| `/api/cron/menu-week-rollout` | GET | requireCronAuth (app/api/cron/menu-week-rollout/route.ts:8) | fail-closed: requireCronAuth |
| `/api/cron/monitoring` | GET | requireCronAuth (app/api/cron/monitoring/route.ts:7) | fail-closed: requireCronAuth |
| `/api/cron/outbox` | GET, POST | requireCronAuth (app/api/cron/outbox/route.ts:8) | fail-closed: requireCronAuth |
| `/api/cron/pipeline` | GET | requireCronAuth (app/api/cron/pipeline/route.ts:12) | fail-closed: requireCronAuth |
| `/api/cron/preprod` | GET | requireCronAuth (app/api/cron/preprod/route.ts:6) | fail-closed: requireCronAuth |
| `/api/cron/revenue` | GET, POST | requireCronAuth (app/api/cron/revenue/route.ts:8) | fail-closed: requireCronAuth |
| `/api/cron/social` | GET | requireCronAuth (app/api/cron/social/route.ts:9) | fail-closed: requireCronAuth |
| `/api/cron/system-motor` | POST | requireCronAuth (app/api/cron/system-motor/route.ts:8) | fail-closed: requireCronAuth |
| `/api/cron/tripletex-agreements-daily` | GET, POST | requireCronAuth (app/api/cron/tripletex-agreements-daily/route.ts:7) | fail-closed: requireCronAuth |
| `/api/cron/tripletex-connection-health-daily` | GET, POST | requireCronAuth (app/api/cron/tripletex-connection-health-daily/route.ts:6) | fail-closed: requireCronAuth |
| `/api/cron/tripletex-outbox` | POST | requireCronAuth (app/api/cron/tripletex-outbox/route.ts:7) | fail-closed: requireCronAuth |
| `/api/cron/tripletex-saas-monthly` | POST | requireCronAuth (app/api/cron/tripletex-saas-monthly/route.ts:6) | fail-closed: requireCronAuth |
| `/api/cron/week-scheduler` | GET | requireCronAuth (app/api/cron/week-scheduler/route.ts:6) | fail-closed: requireCronAuth |
| `/api/cron/week-visibility` | GET, POST | requireCronAuth (app/api/cron/week-visibility/route.ts:9) | fail-closed: requireCronAuth |
| `/api/integrations/execute` | POST | requireCronAuth (app/api/integrations/execute/route.ts:12) | fail-closed: requireCronAuth |
| `/api/internal/production-operative-snapshot/materialize` | POST | requireCronAuth (app/api/internal/production-operative-snapshot/materialize/route.ts:9) | fail-closed: requireCronAuth |
| `/api/internal/scheduler/run` | POST | requireCronAuth (app/api/internal/scheduler/run/route.ts:3) | fail-closed: requireCronAuth |
| `/api/something` | POST | requireCronAuth (app/api/something/route.ts:13) | fail-closed: requireCronAuth |
| `/api/system/outbox/process` | POST | requireCronAuth (app/api/system/outbox/process/route.ts:9) | fail-closed: requireCronAuth |

### A.2 — webhook-sig

| URL | Methods | Bevis (fil:linje) | Rasjonale |
| --- | ------- | ----------------- | --------- |
| `/api/webhooks/sanity/menu-day` | POST | verifySanityWebhookSignature (app/api/webhooks/sanity/menu-day/route.ts:17) | signature: verifySanityWebhookSignature |
| `/api/webhooks/tripletex` | POST | verifyTripletexWebhookSignature (app/api/webhooks/tripletex/route.ts:20) | signature: verifyTripletexWebhookSignature |
| `/api/webhooks/tripletex-provider/[providerId]` | POST | verifyTripletexWebhookSignature (app/api/webhooks/tripletex-provider/[providerId]/route.ts:18) | signature: verifyTripletexWebhookSignature |

### A.3 — anon-allowed (manuell + B3a)

| URL | Methods | Bevis (fil:linje) | Rasjonale |
| --- | ------- | ----------------- | --------- |
| `/api/accept-invite/complete` | GET, POST | B3a bevisst anon prefix /api/accept-invite (app/api/accept-invite/complete/route.ts:48) | (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/address/resolve` | GET | Kartverket read-only resolve | (d) read-only Kartverket lookup |
| `/api/address/search` | GET | address lookup | (d) read-only lookup |
| `/api/admin/accept-invite/complete` | GET, POST | B3a bevisst anon prefix /api/admin (app/api/admin/accept-invite/complete/route.ts:32) | (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/admin/auth/login` | GET, POST | admin auth login | (c) admin auth bootstrap |
| `/api/admin/invites/lookup` | GET | B3a bevisst anon prefix /api/admin (app/api/admin/invites/lookup/route.ts:29) | (a) eksplisitt validering/rate-limit; (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/admin/invites/register` | POST | B3a bevisst anon prefix /api/admin (app/api/admin/invites/register/route.ts:75) | (a) eksplisitt validering/rate-limit; (b) onboarding/PENDING-mønster; (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/auth/accept-invite` | POST | B3a bevisst anon prefix /api/auth (app/api/auth/accept-invite/route.ts:40) | (c) auth bootstrap; (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/auth/forgot-password` | POST | B3a bevisst anon prefix /api/auth (app/api/auth/forgot-password/route.ts:93) | (c) auth bootstrap; (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/auth/login` | POST | auth bootstrap | (b) onboarding/PENDING-mønster; (c) auth bootstrap |
| `/api/auth/login-debug` | GET, POST | auth bootstrap | (c) auth bootstrap |
| `/api/auth/logout` | GET, POST | auth bootstrap | (b) onboarding/PENDING-mønster; (c) auth bootstrap |
| `/api/auth/register-company-admin` | POST | B3a bevisst anon prefix /api/auth (app/api/auth/register-company-admin/route.ts:11) | (b) onboarding/PENDING-mønster; (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/auth/session` | POST | auth bootstrap | (c) auth bootstrap |
| `/api/company/create` | POST | registration | (b) onboarding/PENDING-mønster |
| `/api/contact` | POST | CONTACT_FORM_RL | (a) eksplisitt validering/rate-limit; (a) CONTACT_FORM_RL + zod |
| `/api/content/global/footer` | GET, POST | public CMS read | (d) public CMS read |
| `/api/content/global/header` | GET, POST | public CMS read | (d) public CMS read |
| `/api/driver/confirm` | POST | stub route (410/501, ingen DB/auth) | (d) deprecated/stub — ingen DB-write |
| `/api/experiments/assign` | GET | B3a input-validering før admin (app/api/experiments/assign/route.ts) | (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/experiments/track` | POST | B3a bevisst anon prefix /api/experiments (app/api/experiments/track/route.ts:4) | (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/health` | GET | B3a bevisst anon prefix /api/health (app/api/health/route.ts:7) | (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/health/live` | GET | k8s/readiness probe | (d) health/readiness read-only |
| `/api/health/ready` | GET | k8s/readiness probe | (d) health/readiness read-only |
| `/api/onboarding/complete` | POST | B3a bevisst anon prefix /api/onboarding (app/api/onboarding/complete/route.ts:103) | (b) onboarding/PENDING-mønster; (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/onboarding/terms-pdf` | POST | onboarding validation | (b) onboarding/PENDING-mønster |
| `/api/order/set-choice` | POST | stub route (410/501, ingen DB/auth) | (d) deprecated/stub — ingen DB-write |
| `/api/order/set-day` | POST | stub route (410/501, ingen DB/auth) | (d) deprecated/stub — ingen DB-write |
| `/api/outbox/retry` | POST | stub route (410/501, ingen DB/auth) | (d) deprecated/stub — ingen DB-write |
| `/api/pitch` | GET | public pitch | (d) public read API |
| `/api/public/analytics` | POST | B3a bevisst anon prefix /api/public (app/api/public/analytics/route.ts:113) | (a) eksplisitt validering/rate-limit; (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/public/forms/[id]` | POST | B3a bevisst anon prefix /api/public (app/api/public/forms/[id]/route.ts:43) | (a) eksplisitt validering/rate-limit; (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/public/onboarding/register` | POST | B3a lp_* RPC (app/api/public/onboarding/register/route.ts:172) | (b) onboarding/PENDING-mønster; (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/public/register` | POST | public prefix | (b) onboarding/PENDING-mønster |
| `/api/public/register-company` | POST | B3a lp_* RPC (app/api/public/register-company/route.ts:229) | (b) onboarding/PENDING-mønster; (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/register` | POST | registration | (b) onboarding/PENDING-mønster |
| `/api/social/redirect` | GET | B3a bevisst anon prefix /api/social (app/api/social/redirect/route.ts:10) | (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/social/track` | POST | B3a bevisst anon prefix /api/social (app/api/social/track/route.ts:11) | (b) B3a supabaseAdmin med legitim anon-beskyttelse |
| `/api/superadmin/invoices/mapping` | GET, OPTIONS, POST | stub route (410/501, ingen DB/auth) | (d) deprecated/stub — ingen DB-write |
| `/api/system/time` | GET | read-only klokke/cutoff | (d) read-only klokke/cutoff |
| `/api/saas/billing/webhook` | POST | billing webhook | (a) webhook signature |
| `/api/track/click` | GET | LP_TRACK_CLICK_ALLOW_HOSTS | (a) host allowlist |

### A.4 — api-key (B9)

| URL | Methods | Bevis (fil:linje) | Rasjonale |
| --- | ------- | ----------------- | --------- |
| `/api/v1/public/orders` | GET | B8 via getTenantContext (lib/api/guard.ts:3) | (a) x-api-key via validateApiKey — fail-closed throw INVALID_API_KEY |

## Seksjon B — DEKKET-LISTE (nye angrepsflater som lukkes)

420 ruter med session/role-check — tidligere implicit middleware-bypass.

| URL | Methods | Tidligere bypass-årsak | Forventet klient |
| --- | ------- | ---------------------- | ---------------- |
| `/api/_template` | GET, POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/acquire` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/acquire/strategy` | POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/agreement` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/agreements` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/agreements/current` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/auth` | GET, POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/company/[companyId]/summary` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/company/status/set` | GET, POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/dashboard` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/deliveries` | GET, POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/deliveries/status` | DELETE, GET, PATCH, POST, PUT | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/demand-insights` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/employees` | GET, POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/employees/[userId]/disable` | PATCH | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/employees/activity` | GET, POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/employees/audit` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/employees/export` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/employees/invite` | GET, POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/employees/invites` | POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/employees/invites/link` | POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/employees/invites/resend` | POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/employees/invites/revoke` | POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/employees/invites/stats` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/employees/list` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/employees/resend-invite` | POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/employees/set-disabled` | POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/insight` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/insights` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/invite` | GET, POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/invites` | GET, POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/invites/[id]` | DELETE, PATCH | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/invites/create` | POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/invites/resend` | POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/invites/revoke` | GET, POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/invoices/csv` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/locations` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/locations/audit` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/locations/export` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/locations/status` | POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/me` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/metrics` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/metrics/daily` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/metrics/summary` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/metrics/weekly` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/operations-tower` | GET, POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/orders` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/people` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/support/report` | POST | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |
| `/api/admin/users` | GET | middleware bypasset /api/* — auth kun i route | fetch credentials:include + session cookie |

_… og 370 til (full liste i script JSON: `--json`)._

## Seksjon C — UKLART-REVIEW

| URL | Note | Spotcheck-forslag |
| --- | ---- | ----------------- |
| `/api/admin/invites/resolve` | no recognized auth pattern (app/api/admin/invites/resolve/route.ts) | Les handler — klassifiser session vs anon vs api-key |
| `/api/ai/block/score` | no recognized auth pattern (app/api/ai/block/score/route.ts) | Les handler — klassifiser session vs anon vs api-key |
| `/api/ai/page/build` | no recognized auth pattern (app/api/ai/page/build/route.ts) | Les handler — klassifiser session vs anon vs api-key |
| `/api/auth/remote-backend-harness` | no recognized auth pattern (app/api/auth/remote-backend-harness/route.ts) | Les handler — klassifiser session vs anon vs api-key |
| `/api/edge/ai` | no recognized auth pattern (app/api/edge/ai/route.ts) | Les handler — klassifiser session vs anon vs api-key |
| `/api/edge/metrics` | no recognized auth pattern (app/api/edge/metrics/route.ts) | Les handler — klassifiser session vs anon vs api-key |
| `/api/experiments/results` | no recognized auth pattern (app/api/experiments/results/route.ts) | Les handler — klassifiser session vs anon vs api-key |
| `/api/observability/edge` | no recognized auth pattern (app/api/observability/edge/route.ts) | Les handler — klassifiser session vs anon vs api-key |
| `/api/revenue/lead` | no recognized auth pattern (app/api/revenue/lead/route.ts) | Les handler — klassifiser session vs anon vs api-key |
| `/api/sales/lead` | no recognized auth pattern (app/api/sales/lead/route.ts) | Les handler — klassifiser session vs anon vs api-key |
| `/api/sre/uptime` | no recognized auth pattern (app/api/sre/uptime/route.ts) | Les handler — klassifiser session vs anon vs api-key |
| `/api/system/freeze` | no recognized auth pattern (app/api/system/freeze/route.ts) | Les handler — klassifiser session vs anon vs api-key |

## Seksjon D — FASE 2-D FIX-REQUIRED

### D.1 — fail-open cron (B6b)

| URL | Dagens mønster | Foreslått fix |
| --- | -------------- | ------------- |
| `/api/cron/meal-learning` | `app/api/cron/meal-learning/route.ts:140` — cron env/header (app/api/cron/meal-learning/route.ts:140) [fail-open if secret unset] | requireCronAuth(req) — fail-closed (throws/403 when secret missing or wrong) |

### D.2 — manglende webhook-signatur (B7b)

_Ingen._

### D.3 — B3c UKLART-SECURITY (forventet: 0–3)

| URL | Dagens mønster | Foreslått fix |
| --- | -------------- | ------------- |
| `/api/public/ai-demo-cta/assign` | `app/api/public/ai-demo-cta/assign/route.ts:97` — B3c supabaseAdmin HTTP uten beskyttelse (app/api/public/ai-demo-cta/assign/route.ts:97) | Legg til session/role auth ELLER eksplisitt anon-validering — aldri allowlist |
| `/api/public/demo-interest` | `app/api/public/demo-interest/route.ts:51` — B3c supabaseAdmin HTTP uten beskyttelse (app/api/public/demo-interest/route.ts:51) | Legg til session/role auth ELLER eksplisitt anon-validering — aldri allowlist |
| `/api/public/forms/[id]/schema` | `app/api/public/forms/[id]/schema/route.ts:13` — B3c supabaseAdmin HTTP uten beskyttelse (app/api/public/forms/[id]/schema/route.ts:13) | Legg til session/role auth ELLER eksplisitt anon-validering — aldri allowlist |
| `/api/public/search` | `app/api/public/search/route.ts:33` — B3c supabaseAdmin HTTP uten beskyttelse (app/api/public/search/route.ts:33) | Legg til session/role auth ELLER eksplisitt anon-validering — aldri allowlist |
| `/api/superadmin/users/set-company-admin` | `app/api/superadmin/users/set-company-admin/route.ts:20` — B3c supabaseAdmin HTTP uten beskyttelse (app/api/superadmin/users/set-company-admin/route.ts:20) | Legg til session/role auth ELLER eksplisitt anon-validering — aldri allowlist |
| `/api/system/outbox/process` | `app/api/system/outbox/process/route.ts:9` — B3c supabaseAdmin HTTP uten beskyttelse (app/api/system/outbox/process/route.ts:9) | Legg til session/role auth ELLER eksplisitt anon-validering — aldri allowlist |

### D.4 — anon-rute uten validering

| URL | Dagens mønster | Foreslått fix |
| --- | -------------- | ------------- |
| `/api/auth/debug-cookies` | `app/api/auth/debug-cookies/route.ts:?` — dev debug LP_DEBUG_AUTH | Legg til zod-validering, rate-limit, eller dokumenter // @anon-allowed: <rasjonale> |
| `/api/auth/dev-bypass` | `app/api/auth/dev-bypass/route.ts:?` — auth bootstrap | Legg til zod-validering, rate-limit, eller dokumenter // @anon-allowed: <rasjonale> |
| `/api/auth/profile` | `app/api/auth/profile/route.ts:?` — auth bootstrap | Legg til zod-validering, rate-limit, eller dokumenter // @anon-allowed: <rasjonale> |

## Seksjon E — Åpne spørsmål til bruker

1. **`/api/auth/remote-backend-harness`** — kun test/staging? Skal den allowlistes eller blokkeres i prod?
2. **`/api/system/outbox/process`** — cron-secret eller session? Ekte B3c-kandidat.
3. **B8 `withApiAiEntrypoint`** — observability-only; AI-ruter uten inline auth er KRITISKE (se 🚨).
4. **B3a onboarding/auth** — supabaseAdmin med path-prefix; bekreft at RPC/validering holder i prod.
5. **Wrapper-katalog** — verifiser at `getScope`/`superadminControlTowerJsonGet` dekker alle delegerende ruter.

## Fullstendig rute-tabell (536)

| URL | Methods | Kategori | Batch | Bevis |
| --- | ------- | -------- | ----- | ----- |
| `/api/_template` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/_template/route.ts:8) |
| `/api/accept-invite/complete` | GET, POST | anon-allowed | B3a | B3a bevisst anon prefix /api/accept-invite (app/api/accept-invite/complete/route.ts:48) |
| `/api/acquire` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/acquire/route.ts:10) |
| `/api/acquire/strategy` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/acquire/strategy/route.ts:10) |
| `/api/address/resolve` | GET | anon-allowed | manuell | Kartverket read-only resolve |
| `/api/address/search` | GET | anon-allowed | manuell | address lookup |
| `/api/admin/accept-invite/complete` | GET, POST | anon-allowed | B3a | B3a bevisst anon prefix /api/admin (app/api/admin/accept-invite/complete/route.ts:32) |
| `/api/admin/agreement` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/agreement/route.ts:10) |
| `/api/admin/agreements` | GET | role-check | B4 | B4 → app/api/admin/agreement/route.ts (scopeOr401 + requireRoleOr403 (app/api/admin/agreement/route.ts:10)) |
| `/api/admin/agreements/current` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/agreements/current/route.ts:9) |
| `/api/admin/auth` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/auth/route.ts:8) |
| `/api/admin/auth/login` | GET, POST | anon-allowed | manuell | admin auth login |
| `/api/admin/company/[companyId]/summary` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/company/[companyId]/summary/route.ts:12) |
| `/api/admin/company/status/set` | GET, POST | session | manuell | scopeOr401 (app/api/admin/company/status/set/route.ts:10) |
| `/api/admin/dashboard` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/dashboard/route.ts:9) |
| `/api/admin/deliveries` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/deliveries/route.ts:10) |
| `/api/admin/deliveries/status` | DELETE, GET, PATCH, POST, PUT | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/deliveries/status/route.ts:10) |
| `/api/admin/demand-insights` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/demand-insights/route.ts:11) |
| `/api/admin/employees` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/employees/route.ts:12) |
| `/api/admin/employees/[userId]/disable` | PATCH | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/employees/[userId]/disable/route.ts:12) |
| `/api/admin/employees/activity` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/employees/activity/route.ts:8) |
| `/api/admin/employees/audit` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/employees/audit/route.ts:12) |
| `/api/admin/employees/export` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/employees/export/route.ts:9) |
| `/api/admin/employees/invite` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/employees/invite/route.ts:14) |
| `/api/admin/employees/invites` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/employees/invites/route.ts:11) |
| `/api/admin/employees/invites/link` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/employees/invites/link/route.ts:10) |
| `/api/admin/employees/invites/resend` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/employees/invites/resend/route.ts:14) |
| `/api/admin/employees/invites/revoke` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/employees/invites/revoke/route.ts:12) |
| `/api/admin/employees/invites/stats` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/employees/invites/stats/route.ts:12) |
| `/api/admin/employees/list` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/employees/list/route.ts:12) |
| `/api/admin/employees/resend-invite` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/employees/resend-invite/route.ts:12) |
| `/api/admin/employees/set-disabled` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/employees/set-disabled/route.ts:12) |
| `/api/admin/insight` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/insight/route.ts:13) |
| `/api/admin/insights` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/insights/route.ts:8) |
| `/api/admin/invite` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/invite/route.ts:11) |
| `/api/admin/invites` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/invites/route.ts:11) |
| `/api/admin/invites/[id]` | DELETE, PATCH | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/invites/[id]/route.ts:11) |
| `/api/admin/invites/create` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/invites/create/route.ts:13) |
| `/api/admin/invites/lookup` | GET | anon-allowed | B3a | B3a bevisst anon prefix /api/admin (app/api/admin/invites/lookup/route.ts:29) |
| `/api/admin/invites/register` | POST | anon-allowed | B3a | B3a bevisst anon prefix /api/admin (app/api/admin/invites/register/route.ts:75) |
| `/api/admin/invites/resend` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/invites/resend/route.ts:12) |
| `/api/admin/invites/resolve` | GET | UKLART-REVIEW | manuell | no recognized auth pattern (app/api/admin/invites/resolve/route.ts) |
| `/api/admin/invites/revoke` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/invites/revoke/route.ts:11) |
| `/api/admin/invoices/csv` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/invoices/csv/route.ts:21) |
| `/api/admin/locations` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/locations/route.ts:12) |
| `/api/admin/locations/audit` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/locations/audit/route.ts:12) |
| `/api/admin/locations/export` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/locations/export/route.ts:11) |
| `/api/admin/locations/status` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/locations/status/route.ts:8) |
| `/api/admin/me` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/me/route.ts:12) |
| `/api/admin/metrics` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/metrics/route.ts:12) |
| `/api/admin/metrics/daily` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/metrics/daily/route.ts:13) |
| `/api/admin/metrics/summary` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/metrics/summary/route.ts:13) |
| `/api/admin/metrics/weekly` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/metrics/weekly/route.ts:13) |
| `/api/admin/operations-tower` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/operations-tower/route.ts:18) |
| `/api/admin/orders` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/orders/route.ts:14) |
| `/api/admin/people` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/people/route.ts:9) |
| `/api/admin/support/report` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/support/report/route.ts:8) |
| `/api/admin/users` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/admin/users/route.ts:12) |
| `/api/agreements` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/agreements/route.ts:11) |
| `/api/agreements/my-latest` | GET | session | manuell | supabaseServer().auth.getUser (app/api/agreements/my-latest/route.ts:45) |
| `/api/ai` | (none) | session | B4 | B4 → app/api/ai/page/route.ts (resolveAiTenantExecutionIds → getAuthContext (app/api/ai/page/route.ts:3)) |
| `/api/ai/analyze` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/analyze/route.ts:5) |
| `/api/ai/block` | POST | session | manuell | resolveAiTenantExecutionIds → getAuthContext (app/api/ai/block/route.ts:6) |
| `/api/ai/block/score` | POST | UKLART-REVIEW | manuell | no recognized auth pattern (app/api/ai/block/score/route.ts) |
| `/api/ai/business-engine` | PATCH | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/ai/business-engine/route.ts:21) |
| `/api/ai/continue` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/continue/route.ts:3) |
| `/api/ai/copilot` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/copilot/route.ts:3) |
| `/api/ai/dashboard` | GET | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/dashboard/route.ts:4) |
| `/api/ai/decision` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/decision/route.ts:4) |
| `/api/ai/design/analyze` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/design/analyze/route.ts:3) |
| `/api/ai/design/generate` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/design/generate/route.ts:4) |
| `/api/ai/experiments` | POST | session | manuell | resolveAiTenantExecutionIds → getAuthContext (app/api/ai/experiments/route.ts:4) |
| `/api/ai/generate` | POST | session | manuell | resolveAiTenantExecutionIds → getAuthContext (app/api/ai/generate/route.ts:4) |
| `/api/ai/growth/ads` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/growth/ads/route.ts:3) |
| `/api/ai/growth/funnel` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/growth/funnel/route.ts:3) |
| `/api/ai/growth/seo` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/growth/seo/route.ts:3) |
| `/api/ai/image` | POST | session | manuell | resolveAiTenantExecutionIds → getAuthContext (app/api/ai/image/route.ts:3) |
| `/api/ai/inline` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/inline/route.ts:4) |
| `/api/ai/insights` | GET | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/insights/route.ts:3) |
| `/api/ai/layout` | POST | session | manuell | resolveAiTenantExecutionIds → getAuthContext (app/api/ai/layout/route.ts:3) |
| `/api/ai/learn` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/learn/route.ts:3) |
| `/api/ai/optimize` | POST | session | manuell | resolveAiTenantExecutionIds → getAuthContext (app/api/ai/optimize/route.ts:4) |
| `/api/ai/page` | POST | session | manuell | resolveAiTenantExecutionIds → getAuthContext (app/api/ai/page/route.ts:3) |
| `/api/ai/page/audit` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/page/audit/route.ts:4) |
| `/api/ai/page/build` | POST | UKLART-REVIEW | manuell | no recognized auth pattern (app/api/ai/page/build/route.ts) |
| `/api/ai/recommendation/apply` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/ai/recommendation/apply/route.ts:12) |
| `/api/ai/recommendation/history` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/ai/recommendation/history/route.ts:8) |
| `/api/ai/rewrite` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/ai/rewrite/route.ts:3) |
| `/api/ai/track` | POST | session | manuell | getAuthContext (app/api/ai/track/route.ts:8) |
| `/api/ai/usage` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/ai/usage/route.ts:29) |
| `/api/alerts/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/alerts/run/route.ts:10) |
| `/api/auth/accept-invite` | POST | anon-allowed | B3a | B3a bevisst anon prefix /api/auth (app/api/auth/accept-invite/route.ts:40) |
| `/api/auth/debug-cookies` | GET | anon-allowed | manuell | dev debug LP_DEBUG_AUTH |
| `/api/auth/dev-bypass` | POST | anon-allowed | manuell | auth bootstrap |
| `/api/auth/forgot-password` | POST | anon-allowed | B3a | B3a bevisst anon prefix /api/auth (app/api/auth/forgot-password/route.ts:93) |
| `/api/auth/login` | POST | anon-allowed | manuell | auth bootstrap |
| `/api/auth/login-debug` | GET, POST | anon-allowed | manuell | auth bootstrap |
| `/api/auth/logout` | GET, POST | anon-allowed | manuell | auth bootstrap |
| `/api/auth/me` | GET | session | manuell | getAuthContext (app/api/auth/me/route.ts:8) |
| `/api/auth/post-login` | GET, POST | session | manuell | getAuthContext (app/api/auth/post-login/route.ts:14) |
| `/api/auth/profile` | GET | anon-allowed | manuell | auth bootstrap |
| `/api/auth/redirect` | GET | session | manuell | getAuthContext (app/api/auth/redirect/route.ts:9) |
| `/api/auth/register-company-admin` | POST | anon-allowed | B3a | B3a bevisst anon prefix /api/auth (app/api/auth/register-company-admin/route.ts:11) |
| `/api/auth/remote-backend-harness` | POST | UKLART-REVIEW | manuell | no recognized auth pattern (app/api/auth/remote-backend-harness/route.ts) |
| `/api/auth/session` | POST | anon-allowed | manuell | auth bootstrap |
| `/api/automation/mode` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/automation/mode/route.ts:8) |
| `/api/autonomy/revenue` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/autonomy/revenue/route.ts:10) |
| `/api/autonomy/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/autonomy/run/route.ts:9) |
| `/api/backoffice/ai/apply` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/apply/route.ts:20) |
| `/api/backoffice/ai/auto-improve` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/auto-improve/route.ts:6) |
| `/api/backoffice/ai/block-builder` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/block-builder/route.ts:4) |
| `/api/backoffice/ai/build-home-from-intent` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/build-home-from-intent/route.ts:6) |
| `/api/backoffice/ai/capability` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/capability/route.ts:3) |
| `/api/backoffice/ai/cms-menu` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/cms-menu/route.ts:8) |
| `/api/backoffice/ai/cta-improve` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/cta-improve/route.ts:9) |
| `/api/backoffice/ai/design-optimizer/analyze` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/design-optimizer/analyze/route.ts:16) |
| `/api/backoffice/ai/design-optimizer/apply` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/design-optimizer/apply/route.ts:22) |
| `/api/backoffice/ai/design-optimizer/revert` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/design-optimizer/revert/route.ts:9) |
| `/api/backoffice/ai/design-suggestion/log-apply` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/design-suggestion/log-apply/route.ts:3) |
| `/api/backoffice/ai/health/latest` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/health/latest/route.ts:8) |
| `/api/backoffice/ai/health/scan` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/health/scan/route.ts:10) |
| `/api/backoffice/ai/image-generator` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/image-generator/route.ts:10) |
| `/api/backoffice/ai/image-metadata` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/image-metadata/route.ts:10) |
| `/api/backoffice/ai/intelligence/dashboard` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/intelligence/dashboard/route.ts:5) |
| `/api/backoffice/ai/intelligence/events` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/intelligence/events/route.ts:7) |
| `/api/backoffice/ai/intelligence/query` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/intelligence/query/route.ts:5) |
| `/api/backoffice/ai/jobs` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/jobs/route.ts:8) |
| `/api/backoffice/ai/jobs/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/jobs/run/route.ts:10) |
| `/api/backoffice/ai/layout-suggestions` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/layout-suggestions/route.ts:5) |
| `/api/backoffice/ai/page-builder` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/page-builder/route.ts:2) |
| `/api/backoffice/ai/page-intelligence` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/page-intelligence/route.ts:12) |
| `/api/backoffice/ai/screenshot-builder` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/screenshot-builder/route.ts:9) |
| `/api/backoffice/ai/seo-intelligence` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/seo-intelligence/route.ts:5) |
| `/api/backoffice/ai/status` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/status/route.ts:13) |
| `/api/backoffice/ai/suggest` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/suggest/route.ts:22) |
| `/api/backoffice/ai/suggestions` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/suggestions/route.ts:8) |
| `/api/backoffice/ai/suggestions/[id]` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/suggestions/[id]/route.ts:11) |
| `/api/backoffice/ai/suggestions/[id]/status` | PATCH | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/suggestions/[id]/status/route.ts:8) |
| `/api/backoffice/ai/text-improve` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ai/text-improve/route.ts:9) |
| `/api/backoffice/autonomy/feedback` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/autonomy/feedback/route.ts:12) |
| `/api/backoffice/autonomy/optimize` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/autonomy/optimize/route.ts:8) |
| `/api/backoffice/autonomy/recommendations` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/autonomy/recommendations/route.ts:8) |
| `/api/backoffice/autonomy/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/autonomy/run/route.ts:10) |
| `/api/backoffice/ceo/feedback` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ceo/feedback/route.ts:12) |
| `/api/backoffice/ceo/recommendations` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ceo/recommendations/route.ts:11) |
| `/api/backoffice/ceo/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/ceo/run/route.ts:10) |
| `/api/backoffice/cms/block-editor-data-types` | GET, PUT | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/cms/block-editor-data-types/route.ts:20) |
| `/api/backoffice/cms/composition-definitions` | GET, PUT | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/cms/composition-definitions/route.ts:21) |
| `/api/backoffice/cms/document-type-definitions` | GET, PUT | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/cms/document-type-definitions/route.ts:27) |
| `/api/backoffice/cms/element-type-runtime` | GET, PUT | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/cms/element-type-runtime/route.ts:16) |
| `/api/backoffice/cms/language-definitions` | GET, PUT | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/cms/language-definitions/route.ts:17) |
| `/api/backoffice/cms/menu-draft` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/cms/menu-draft/route.ts:8) |
| `/api/backoffice/company/control-tower` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/company/control-tower/route.ts:14) |
| `/api/backoffice/content/audit-log` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/audit-log/route.ts:18) |
| `/api/backoffice/content/batch-normalize-legacy` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/batch-normalize-legacy/route.ts:11) |
| `/api/backoffice/content/build-home` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/build-home/route.ts:6) |
| `/api/backoffice/content/footer-config` | GET, PATCH | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/footer-config/route.ts:7) |
| `/api/backoffice/content/governance-registry` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/governance-registry/route.ts:13) |
| `/api/backoffice/content/governance-usage` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/governance-usage/route.ts:10) |
| `/api/backoffice/content/header-config/[variant]` | GET, PATCH | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/header-config/[variant]/route.ts:7) |
| `/api/backoffice/content/home` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/home/route.ts:8) |
| `/api/backoffice/content/pages` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/pages/route.ts:19) |
| `/api/backoffice/content/pages/[id]` | GET, PATCH | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/pages/[id]/route.ts:21) |
| `/api/backoffice/content/pages/[id]/check-release` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/pages/[id]/check-release/route.ts:12) |
| `/api/backoffice/content/pages/[id]/insights` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/pages/[id]/insights/route.ts:19) |
| `/api/backoffice/content/pages/[id]/published-body` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/pages/[id]/published-body/route.ts:16) |
| `/api/backoffice/content/pages/[id]/variant/publish` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/pages/[id]/variant/publish/route.ts:29) |
| `/api/backoffice/content/pages/[id]/workflow` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/pages/[id]/workflow/route.ts:34) |
| `/api/backoffice/content/pages/by-slug` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/pages/by-slug/route.ts:3) |
| `/api/backoffice/content/publish-home` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/publish-home/route.ts:8) |
| `/api/backoffice/content/tree` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/tree/route.ts:17) |
| `/api/backoffice/content/tree/move` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/content/tree/move/route.ts:9) |
| `/api/backoffice/control-plane/discovery-entity-bundle` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/control-plane/discovery-entity-bundle/route.ts:7) |
| `/api/backoffice/control-tower` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/control-tower/route.ts:9) |
| `/api/backoffice/enterprise/page-insights` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/enterprise/page-insights/route.ts:10) |
| `/api/backoffice/experiments` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/experiments/route.ts:3) |
| `/api/backoffice/experiments/[id]` | GET, PATCH | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/experiments/[id]/route.ts:5) |
| `/api/backoffice/experiments/create` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/experiments/create/route.ts:7) |
| `/api/backoffice/experiments/event` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/backoffice/experiments/event/route.ts:5) |
| `/api/backoffice/experiments/resolve` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/experiments/resolve/route.ts:7) |
| `/api/backoffice/experiments/stats` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/experiments/stats/route.ts:11) |
| `/api/backoffice/forms` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/forms/route.ts:48) |
| `/api/backoffice/forms/[id]` | GET, PATCH | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/forms/[id]/route.ts:11) |
| `/api/backoffice/forms/[id]/submissions` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/forms/[id]/submissions/route.ts:10) |
| `/api/backoffice/growth/summary` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/growth/summary/route.ts:4) |
| `/api/backoffice/media/items` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/media/items/route.ts:3) |
| `/api/backoffice/media/items/[id]` | DELETE, GET, PATCH | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/media/items/[id]/route.ts:3) |
| `/api/backoffice/media/upload` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/media/upload/route.ts:45) |
| `/api/backoffice/releases` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/releases/route.ts:13) |
| `/api/backoffice/releases/[id]` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/releases/[id]/route.ts:12) |
| `/api/backoffice/releases/[id]/execute` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/releases/[id]/execute/route.ts:14) |
| `/api/backoffice/releases/[id]/items` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/releases/[id]/items/route.ts:12) |
| `/api/backoffice/releases/[id]/items/[variantId]` | DELETE | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/releases/[id]/items/[variantId]/route.ts:12) |
| `/api/backoffice/releases/[id]/schedule` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/releases/[id]/schedule/route.ts:12) |
| `/api/backoffice/revenue/insights` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/revenue/insights/route.ts:20) |
| `/api/backoffice/settings` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/settings/route.ts:7) |
| `/api/backoffice/translation/summary` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/translation/summary/route.ts:11) |
| `/api/backoffice/users` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/backoffice/users/route.ts:3) |
| `/api/board` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/board/route.ts:10) |
| `/api/business/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/business/run/route.ts:11) |
| `/api/ceo/brain` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/ceo/brain/route.ts:14) |
| `/api/ceo/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/ceo/run/route.ts:13) |
| `/api/ceo/snapshot` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/ceo/snapshot/route.ts:10) |
| `/api/chaos/load` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/chaos/load/route.ts:10) |
| `/api/company/create` | POST | anon-allowed | manuell | registration |
| `/api/contact` | POST | anon-allowed | manuell | CONTACT_FORM_RL |
| `/api/content/global/footer` | GET, POST | anon-allowed | manuell | public CMS read |
| `/api/content/global/header` | GET, POST | anon-allowed | manuell | public CMS read |
| `/api/content/global/settings` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/content/global/settings/route.ts:7) |
| `/api/control-tower` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/control-tower/route.ts:9) |
| `/api/control-tower/snapshot` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/control-tower/snapshot/route.ts:8) |
| `/api/crm/lead` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/crm/lead/route.ts:10) |
| `/api/cron/ai-experiment-generator` | POST | cron-secret | manuell | requireCronAuth (app/api/cron/ai-experiment-generator/route.ts:8) |
| `/api/cron/autopilot` | GET | cron-secret | manuell | requireCronAuth (app/api/cron/autopilot/route.ts:10) |
| `/api/cron/business` | GET, POST | cron-secret | manuell | requireCronAuth (app/api/cron/business/route.ts:8) |
| `/api/cron/check-deviations` | GET, POST | cron-secret | manuell | requireCronAuth (app/api/cron/check-deviations/route.ts:7) |
| `/api/cron/cleanup-invites` | POST | cron-secret | manuell | requireCronAuth (app/api/cron/cleanup-invites/route.ts:6) |
| `/api/cron/daily-order-summary` | POST | cron-secret | manuell | requireCronAuth (app/api/cron/daily-order-summary/route.ts:7) |
| `/api/cron/daily-sanity` | GET | cron-secret | manuell | requireCronAuth (app/api/cron/daily-sanity/route.ts:17) |
| `/api/cron/experiments` | POST | cron-secret | manuell | requireCronAuth (app/api/cron/experiments/route.ts:9) |
| `/api/cron/forecast` | GET | cron-secret | manuell | requireCronAuth (app/api/cron/forecast/route.ts:6) |
| `/api/cron/global-learning` | POST | cron-secret | manuell | requireCronAuth (app/api/cron/global-learning/route.ts:8) |
| `/api/cron/invoices/generate` | GET | cron-secret | manuell | requireCronAuth (app/api/cron/invoices/generate/route.ts:11) |
| `/api/cron/kitchen-print` | GET | cron-secret | manuell | requireCronAuth (app/api/cron/kitchen-print/route.ts:9) |
| `/api/cron/meal-learning` | GET | cron-secret | manuell | cron env/header (app/api/cron/meal-learning/route.ts:140) [fail-open if secret unset] |
| `/api/cron/menu-service-day-reconcile` | GET | cron-secret | manuell | requireCronAuth (app/api/cron/menu-service-day-reconcile/route.ts:9) |
| `/api/cron/menu-week-rollout` | GET | cron-secret | manuell | requireCronAuth (app/api/cron/menu-week-rollout/route.ts:8) |
| `/api/cron/monitoring` | GET | cron-secret | manuell | requireCronAuth (app/api/cron/monitoring/route.ts:7) |
| `/api/cron/outbox` | GET, POST | cron-secret | manuell | requireCronAuth (app/api/cron/outbox/route.ts:8) |
| `/api/cron/pipeline` | GET | cron-secret | manuell | requireCronAuth (app/api/cron/pipeline/route.ts:12) |
| `/api/cron/preprod` | GET | cron-secret | manuell | requireCronAuth (app/api/cron/preprod/route.ts:6) |
| `/api/cron/revenue` | GET, POST | cron-secret | manuell | requireCronAuth (app/api/cron/revenue/route.ts:8) |
| `/api/cron/social` | GET | cron-secret | manuell | requireCronAuth (app/api/cron/social/route.ts:9) |
| `/api/cron/system-motor` | POST | cron-secret | manuell | requireCronAuth (app/api/cron/system-motor/route.ts:8) |
| `/api/cron/tripletex-agreements-daily` | GET, POST | cron-secret | manuell | requireCronAuth (app/api/cron/tripletex-agreements-daily/route.ts:7) |
| `/api/cron/tripletex-connection-health-daily` | GET, POST | cron-secret | manuell | requireCronAuth (app/api/cron/tripletex-connection-health-daily/route.ts:6) |
| `/api/cron/tripletex-outbox` | POST | cron-secret | manuell | requireCronAuth (app/api/cron/tripletex-outbox/route.ts:7) |
| `/api/cron/tripletex-saas-monthly` | POST | cron-secret | manuell | requireCronAuth (app/api/cron/tripletex-saas-monthly/route.ts:6) |
| `/api/cron/week-scheduler` | GET | cron-secret | manuell | requireCronAuth (app/api/cron/week-scheduler/route.ts:6) |
| `/api/cron/week-visibility` | GET, POST | cron-secret | manuell | requireCronAuth (app/api/cron/week-visibility/route.ts:9) |
| `/api/cto/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/cto/run/route.ts:16) |
| `/api/customers/register` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/customers/register/route.ts:10) |
| `/api/driver/bulk-set` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/driver/bulk-set/route.ts:11) |
| `/api/driver/confirm` | POST | anon-allowed | manuell | stub route (410/501, ingen DB/auth) |
| `/api/driver/orders` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/driver/orders/route.ts:10) |
| `/api/driver/stops` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/driver/stops/route.ts:9) |
| `/api/driver/today` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/driver/today/route.ts:9) |
| `/api/edge/ai` | GET | UKLART-REVIEW | manuell | no recognized auth pattern (app/api/edge/ai/route.ts) |
| `/api/edge/metrics` | GET | UKLART-REVIEW | manuell | no recognized auth pattern (app/api/edge/metrics/route.ts) |
| `/api/editor-ai/metrics` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/editor-ai/metrics/route.ts:4) |
| `/api/events/publish` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/events/publish/route.ts:13) |
| `/api/example` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/example/route.ts:8) |
| `/api/execution/approve` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/execution/approve/route.ts:8) |
| `/api/execution/create` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/execution/create/route.ts:9) |
| `/api/execution/queue` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/execution/queue/route.ts:8) |
| `/api/execution/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/execution/run/route.ts:9) |
| `/api/exit` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/exit/route.ts:10) |
| `/api/exit/execute` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/exit/execute/route.ts:11) |
| `/api/exit/now` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/exit/now/route.ts:12) |
| `/api/exit/sell` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/exit/sell/route.ts:11) |
| `/api/experiments/assign` | GET | anon-allowed | B3a | B3a input-validering før admin (app/api/experiments/assign/route.ts) |
| `/api/experiments/results` | GET | UKLART-REVIEW | manuell | no recognized auth pattern (app/api/experiments/results/route.ts) |
| `/api/experiments/rollout` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/experiments/rollout/route.ts:5) |
| `/api/experiments/track` | POST | anon-allowed | B3a | B3a bevisst anon prefix /api/experiments (app/api/experiments/track/route.ts:4) |
| `/api/experiments/winner` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/experiments/winner/route.ts:7) |
| `/api/global/expand` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/global/expand/route.ts:11) |
| `/api/global/markets` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/global/markets/route.ts:10) |
| `/api/global/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/global/run/route.ts:11) |
| `/api/growth/multichannel` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/growth/multichannel/route.ts:16) |
| `/api/growth/optimize` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/growth/optimize/route.ts:9) |
| `/api/health` | GET | anon-allowed | B3a | B3a bevisst anon prefix /api/health (app/api/health/route.ts:7) |
| `/api/health/live` | GET | anon-allowed | manuell | k8s/readiness probe |
| `/api/health/ready` | GET | anon-allowed | manuell | k8s/readiness probe |
| `/api/integrations/execute` | POST | cron-secret | manuell | requireCronAuth (app/api/integrations/execute/route.ts:12) |
| `/api/internal/production-operative-snapshot/materialize` | POST | cron-secret | manuell | requireCronAuth (app/api/internal/production-operative-snapshot/materialize/route.ts:9) |
| `/api/internal/scheduler/run` | POST | cron-secret | manuell | requireCronAuth (app/api/internal/scheduler/run/route.ts:3) |
| `/api/investor/valuation` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/investor/valuation/route.ts:9) |
| `/api/ipo` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/ipo/route.ts:11) |
| `/api/kitchen` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/route.ts:9) |
| `/api/kitchen/batch` | PATCH | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/batch/route.ts:10) |
| `/api/kitchen/batch/get` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/batch/get/route.ts:11) |
| `/api/kitchen/batch/list` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/batch/list/route.ts:11) |
| `/api/kitchen/batch/reset` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/batch/reset/route.ts:11) |
| `/api/kitchen/batch/set` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/batch/set/route.ts:10) |
| `/api/kitchen/batch/start` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/batch/start/route.ts:9) |
| `/api/kitchen/batch/summary` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/batch/summary/route.ts:10) |
| `/api/kitchen/batch/upsert` | POST | role-check | B4 | B4 → app/api/kitchen/batch/set/route.ts (scopeOr401 + requireRoleOr403 (app/api/kitchen/batch/set/route.ts:10)) |
| `/api/kitchen/companies` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/companies/route.ts:14) |
| `/api/kitchen/company` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/company/route.ts:15) |
| `/api/kitchen/day` | GET | session | manuell | supabaseServer().auth.getUser (app/api/kitchen/day/route.ts:34) |
| `/api/kitchen/demand-forecast` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/demand-forecast/route.ts:11) |
| `/api/kitchen/orders` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/orders/route.ts:9) |
| `/api/kitchen/orders.csv` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/orders.csv/route.ts:9) |
| `/api/kitchen/orders/batch-status` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/orders/batch-status/route.ts:9) |
| `/api/kitchen/report` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/report/route.ts:12) |
| `/api/kitchen/report.csv` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/kitchen/report.csv/route.ts:12) |
| `/api/kitchen/today` | GET | session | B4 | B4 → app/api/kitchen/day/route.ts (supabaseServer().auth.getUser (app/api/kitchen/day/route.ts:34)) |
| `/api/market` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/market/route.ts:10) |
| `/api/market/domination` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/market/domination/route.ts:11) |
| `/api/me` | GET | session | manuell | supabaseServer().auth.getUser (app/api/me/route.ts:24) |
| `/api/me/agreement` | GET | session | manuell | supabaseServer().auth.getUser (app/api/me/agreement/route.ts:23) |
| `/api/observability` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/observability/route.ts:10) |
| `/api/observability/edge` | GET | UKLART-REVIEW | manuell | no recognized auth pattern (app/api/observability/edge/route.ts) |
| `/api/onboarding/complete` | POST | anon-allowed | B3a | B3a bevisst anon prefix /api/onboarding (app/api/onboarding/complete/route.ts:103) |
| `/api/onboarding/terms-pdf` | POST | anon-allowed | manuell | onboarding validation |
| `/api/ops` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/ops/route.ts:8) |
| `/api/ops/global` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/ops/global/route.ts:7) |
| `/api/order` | DELETE, GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/order/route.ts:8) |
| `/api/order/bulk-set` | POST | session | B1 | B1 getScope (app/api/order/bulk-set/route.ts:136) |
| `/api/order/cancel` | POST | session | manuell | supabaseServer().auth.getUser (app/api/order/cancel/route.ts:160) |
| `/api/order/set-choice` | POST | anon-allowed | manuell | stub route (410/501, ingen DB/auth) |
| `/api/order/set-day` | POST | anon-allowed | manuell | stub route (410/501, ingen DB/auth) |
| `/api/order/week-demand-hints` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/order/week-demand-hints/route.ts:12) |
| `/api/order/window` | GET | session | manuell | scopeOr401 (app/api/order/window/route.ts:14) |
| `/api/orders` | DELETE, GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/orders/route.ts:20) |
| `/api/orders/[orderId]` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/orders/[orderId]/route.ts:13) |
| `/api/orders/[orderId]/cancel` | PATCH | session | manuell | supabaseServer().auth.getUser (app/api/orders/[orderId]/cancel/route.ts:100) |
| `/api/orders/[orderId]/toggle` | POST | session | manuell | supabaseServer().auth.getUser (app/api/orders/[orderId]/toggle/route.ts:109) |
| `/api/orders/cancel` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/orders/cancel/route.ts:14) |
| `/api/orders/choice` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/orders/choice/route.ts:10) |
| `/api/orders/export` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/orders/export/route.ts:13) |
| `/api/orders/my` | DELETE, GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/orders/my/route.ts:9) |
| `/api/orders/set` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/orders/set/route.ts:11) |
| `/api/orders/today` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/orders/today/route.ts:15) |
| `/api/orders/toggle` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/orders/toggle/route.ts:12) |
| `/api/orders/week` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/orders/week/route.ts:10) |
| `/api/outbound/generate` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/outbound/generate/route.ts:8) |
| `/api/outbox/process` | POST | session | manuell | supabaseServer().auth.getUser (app/api/outbox/process/route.ts:34) |
| `/api/outbox/retry` | POST | anon-allowed | manuell | stub route (410/501, ingen DB/auth) |
| `/api/page/rollback` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/page/rollback/route.ts:10) |
| `/api/page/version/[id]` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/page/version/[id]/route.ts:5) |
| `/api/page/versions` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/page/versions/route.ts:11) |
| `/api/pipeline/actions` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/pipeline/actions/route.ts:13) |
| `/api/pipeline/deals` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/pipeline/deals/route.ts:12) |
| `/api/pipeline/update-stage` | PATCH | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/pipeline/update-stage/route.ts:12) |
| `/api/pitch` | GET | anon-allowed | manuell | public pitch |
| `/api/profile` | GET | session | manuell | getAuthContext (app/api/profile/route.ts:6) |
| `/api/profile/set-scope` | POST | session | manuell | supabaseServer().auth.getUser (app/api/profile/set-scope/route.ts:36) |
| `/api/public/ai-demo-cta/assign` | POST | UKLART-SECURITY | B3c | B3c supabaseAdmin HTTP uten beskyttelse (app/api/public/ai-demo-cta/assign/route.ts:97) |
| `/api/public/analytics` | POST | anon-allowed | B3a | B3a bevisst anon prefix /api/public (app/api/public/analytics/route.ts:113) |
| `/api/public/demo-interest` | POST | UKLART-SECURITY | B3c | B3c supabaseAdmin HTTP uten beskyttelse (app/api/public/demo-interest/route.ts:51) |
| `/api/public/forms/[id]` | POST | anon-allowed | B3a | B3a bevisst anon prefix /api/public (app/api/public/forms/[id]/route.ts:43) |
| `/api/public/forms/[id]/schema` | GET | UKLART-SECURITY | B3c | B3c supabaseAdmin HTTP uten beskyttelse (app/api/public/forms/[id]/schema/route.ts:13) |
| `/api/public/onboarding/create-admin` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/public/onboarding/create-admin/route.ts:9) |
| `/api/public/onboarding/register` | POST | anon-allowed | B3a | B3a lp_* RPC (app/api/public/onboarding/register/route.ts:172) |
| `/api/public/register` | POST | anon-allowed | manuell | public prefix |
| `/api/public/register-company` | POST | anon-allowed | B3a | B3a lp_* RPC (app/api/public/register-company/route.ts:229) |
| `/api/public/search` | GET | UKLART-SECURITY | B3c | B3c supabaseAdmin HTTP uten beskyttelse (app/api/public/search/route.ts:33) |
| `/api/public/track-event` | POST | UKLART-SECURITY | B8-withApiAiEntrypoint-NO-AUTH | B8 withApiAiEntrypoint er IKKE-AUTH (lib/http/withApiAiEntrypoint.ts) (app/api/public/track-event/route.ts:8) |
| `/api/queue/add` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/queue/add/route.ts:9) |
| `/api/register` | POST | anon-allowed | manuell | registration |
| `/api/revenue` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/revenue/route.ts:11) |
| `/api/revenue/autopilot` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/revenue/autopilot/route.ts:9) |
| `/api/revenue/brain` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/revenue/brain/route.ts:14) |
| `/api/revenue/lead` | POST | UKLART-REVIEW | manuell | no recognized auth pattern (app/api/revenue/lead/route.ts) |
| `/api/revenue/live` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/revenue/live/route.ts:8) |
| `/api/revenue/pipeline` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/revenue/pipeline/route.ts:9) |
| `/api/sales/agent/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sales/agent/run/route.ts:14) |
| `/api/sales/ai` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sales/ai/route.ts:8) |
| `/api/sales/closing/execute` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sales/closing/execute/route.ts:10) |
| `/api/sales/closing/ready` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sales/closing/ready/route.ts:9) |
| `/api/sales/cockpit/log` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sales/cockpit/log/route.ts:11) |
| `/api/sales/lead` | POST | UKLART-REVIEW | manuell | no recognized auth pattern (app/api/sales/lead/route.ts) |
| `/api/sales/loop/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sales/loop/run/route.ts:12) |
| `/api/sales/objection/reply` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sales/objection/reply/route.ts:11) |
| `/api/sales/objection/send` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sales/objection/send/route.ts:9) |
| `/api/sales/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sales/run/route.ts:13) |
| `/api/sales/scale` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sales/scale/route.ts:12) |
| `/api/sales/send` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sales/send/route.ts:11) |
| `/api/sales/sequence/inbound` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sales/sequence/inbound/route.ts:12) |
| `/api/sales/sequence/timeline` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sales/sequence/timeline/route.ts:10) |
| `/api/scope/options` | GET | session | manuell | supabaseServer().auth.getUser (app/api/scope/options/route.ts:16) |
| `/api/sdr/queue` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sdr/queue/route.ts:8) |
| `/api/sdr/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sdr/run/route.ts:8) |
| `/api/security/alerts` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/security/alerts/route.ts:7) |
| `/api/security/audit` | GET | session | manuell | scopeOr401 (app/api/security/audit/route.ts:8) |
| `/api/social/ab/analytics` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/social/ab/analytics/route.ts:10) |
| `/api/social/ab/decisions` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/social/ab/decisions/route.ts:9) |
| `/api/social/ai` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/social/ai/route.ts:22) |
| `/api/social/ai/generate` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/social/ai/generate/route.ts:9) |
| `/api/social/analytics` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/social/analytics/route.ts:13) |
| `/api/social/autonomous/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/social/autonomous/run/route.ts:9) |
| `/api/social/posts` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/social/posts/route.ts:8) |
| `/api/social/posts/[id]` | PATCH | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/social/posts/[id]/route.ts:9) |
| `/api/social/posts/publish` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/social/posts/publish/route.ts:9) |
| `/api/social/posts/save` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/social/posts/save/route.ts:11) |
| `/api/social/recommendations` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/social/recommendations/route.ts:14) |
| `/api/social/redirect` | GET | anon-allowed | B3a | B3a bevisst anon prefix /api/social (app/api/social/redirect/route.ts:10) |
| `/api/social/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/social/run/route.ts:12) |
| `/api/social/track` | POST | anon-allowed | B3a | B3a bevisst anon prefix /api/social (app/api/social/track/route.ts:11) |
| `/api/social/unified/generate` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/social/unified/generate/route.ts:8) |
| `/api/something` | POST | cron-secret | manuell | requireCronAuth (app/api/something/route.ts:13) |
| `/api/sre/metrics` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/sre/metrics/route.ts:9) |
| `/api/sre/uptime` | GET | UKLART-REVIEW | manuell | no recognized auth pattern (app/api/sre/uptime/route.ts) |
| `/api/strategy/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/strategy/run/route.ts:9) |
| `/api/stream` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/stream/route.ts:9) |
| `/api/superadmin/_gate` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/_gate/route.ts:8) |
| `/api/superadmin/agreements` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/agreements/route.ts:9) |
| `/api/superadmin/agreements/[agreementId]/activate` | DELETE, GET, POST, PUT | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/agreements/[agreementId]/activate/route.ts:17) |
| `/api/superadmin/agreements/[agreementId]/approve` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/agreements/[agreementId]/approve/route.ts:12) |
| `/api/superadmin/agreements/[agreementId]/close` | DELETE, GET, POST, PUT | session | B1 | B1 getScope (app/api/superadmin/agreements/[agreementId]/close/route.ts:40) |
| `/api/superadmin/agreements/[agreementId]/pause` | DELETE, GET, POST, PUT | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/agreements/[agreementId]/pause/route.ts:10) |
| `/api/superadmin/agreements/[agreementId]/pause-ledger` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/agreements/[agreementId]/pause-ledger/route.ts:7) |
| `/api/superadmin/agreements/[agreementId]/reject` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/agreements/[agreementId]/reject/route.ts:7) |
| `/api/superadmin/agreements/[agreementId]/resume` | DELETE, GET, POST, PUT | session | B1 | B1 getScope (app/api/superadmin/agreements/[agreementId]/resume/route.ts:24) |
| `/api/superadmin/agreements/list` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/agreements/list/route.ts:10) |
| `/api/superadmin/ai-config` | GET, PATCH | session | manuell | getAuthContext (app/api/superadmin/ai-config/route.ts:5) |
| `/api/superadmin/ai-prompts` | PATCH | session | manuell | getAuthContext (app/api/superadmin/ai-prompts/route.ts:5) |
| `/api/superadmin/audit` | GET | role-check | manuell | inline superadmin gate (app/api/superadmin/audit/route.ts:12) |
| `/api/superadmin/audit-meta/recent` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/audit-meta/recent/route.ts:6) |
| `/api/superadmin/audit-write` | POST | role-check | manuell | inline superadmin gate (app/api/superadmin/audit-write/route.ts:7) |
| `/api/superadmin/audit/[id]` | GET | role-check | manuell | inline superadmin gate (app/api/superadmin/audit/[id]/route.ts:9) |
| `/api/superadmin/autonomy` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/autonomy/route.ts:12) |
| `/api/superadmin/autonomy/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/autonomy/run/route.ts:11) |
| `/api/superadmin/billing-accounts` | POST | role-check | B2 | B2 requireRole (app/api/superadmin/billing-accounts/route.ts:25) |
| `/api/superadmin/billing/export` | GET | role-check | manuell | inline superadmin gate (app/api/superadmin/billing/export/route.ts:9) |
| `/api/superadmin/break-glass` | DELETE, GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/break-glass/route.ts:8) |
| `/api/superadmin/cfo/summary` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/cfo/summary/route.ts:8) |
| `/api/superadmin/companies` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/companies/route.ts:10) |
| `/api/superadmin/companies/[companyId]` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/companies/[companyId]/route.ts:7) |
| `/api/superadmin/companies/[companyId]/activate` | POST | role-check | B4 | B4 → app/api/superadmin/companies/set-status/route.ts (scopeOr401 + requireRoleOr403 (app/api/superadmin/companies/set-status/route.ts:10)) |
| `/api/superadmin/companies/[companyId]/agreement/status` | DELETE, GET, POST, PUT | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/companies/[companyId]/agreement/status/route.ts:8) |
| `/api/superadmin/companies/[companyId]/archive` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/companies/[companyId]/archive/route.ts:8) |
| `/api/superadmin/companies/[companyId]/archive/orders` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/companies/[companyId]/archive/orders/route.ts:8) |
| `/api/superadmin/companies/[companyId]/archive/summary` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/companies/[companyId]/archive/summary/route.ts:8) |
| `/api/superadmin/companies/[companyId]/invoice-basis` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/companies/[companyId]/invoice-basis/route.ts:8) |
| `/api/superadmin/companies/[companyId]/orders` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/companies/[companyId]/orders/route.ts:8) |
| `/api/superadmin/companies/[companyId]/reject` | POST | role-check | B4 | B4 → app/api/superadmin/companies/set-status/route.ts (scopeOr401 + requireRoleOr403 (app/api/superadmin/companies/set-status/route.ts:10)) |
| `/api/superadmin/companies/agreement` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/companies/agreement/route.ts:8) |
| `/api/superadmin/companies/invoices` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/companies/invoices/route.ts:8) |
| `/api/superadmin/companies/set-status` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/companies/set-status/route.ts:10) |
| `/api/superadmin/companies/stats` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/companies/stats/route.ts:8) |
| `/api/superadmin/company-registrations` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/company-registrations/route.ts:9) |
| `/api/superadmin/company-registrations/[companyId]` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/company-registrations/[companyId]/route.ts:9) |
| `/api/superadmin/company-registrations/[companyId]/create-agreement-draft` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/company-registrations/[companyId]/create-agreement-draft/route.ts:9) |
| `/api/superadmin/company/[companyId]/activate` | POST | role-check | manuell | inline superadmin gate (app/api/superadmin/company/[companyId]/activate/route.ts:10) |
| `/api/superadmin/control-tower` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/control-tower/route.ts:9) |
| `/api/superadmin/control-tower/autopilot` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/control-tower/autopilot/route.ts:18) |
| `/api/superadmin/control-tower/data` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/control-tower/data/route.ts:10) |
| `/api/superadmin/control-tower/domination` | GET | role-check | B2 | B2 superadminControlTowerJsonGet (app/api/superadmin/control-tower/domination/route.ts:15) |
| `/api/superadmin/control-tower/golive` | GET | role-check | B2 | B2 superadminControlTowerJsonGet (app/api/superadmin/control-tower/golive/route.ts:31) |
| `/api/superadmin/control-tower/monopoly` | GET | role-check | B2 | B2 superadminControlTowerJsonGet (app/api/superadmin/control-tower/monopoly/route.ts:40) |
| `/api/superadmin/control-tower/scale` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/control-tower/scale/route.ts:21) |
| `/api/superadmin/control-tower/snapshot` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/control-tower/snapshot/route.ts:9) |
| `/api/superadmin/dashboard` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/dashboard/route.ts:9) |
| `/api/superadmin/deviations` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/deviations/route.ts:9) |
| `/api/superadmin/diagnostics` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/diagnostics/route.ts:8) |
| `/api/superadmin/diagnostics/repair` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/diagnostics/repair/route.ts:8) |
| `/api/superadmin/employees/[userId]` | DELETE, PATCH | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/employees/[userId]/route.ts:8) |
| `/api/superadmin/enterprise` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/enterprise/route.ts:8) |
| `/api/superadmin/enterprise/[groupId]` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/enterprise/[groupId]/route.ts:8) |
| `/api/superadmin/experiments` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/experiments/route.ts:11) |
| `/api/superadmin/firms/[companyId]/employees` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/firms/[companyId]/employees/route.ts:8) |
| `/api/superadmin/firms/[companyId]/employees/delete` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/firms/[companyId]/employees/delete/route.ts:8) |
| `/api/superadmin/global-intelligence/summary` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/global-intelligence/summary/route.ts:8) |
| `/api/superadmin/growth-optimization` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/growth-optimization/route.ts:9) |
| `/api/superadmin/growth/capital-allocate` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/growth/capital-allocate/route.ts:9) |
| `/api/superadmin/investor` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/investor/route.ts:12) |
| `/api/superadmin/investor/metrics` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/investor/metrics/route.ts:9) |
| `/api/superadmin/invoices/csv` | GET | role-check | manuell | inline superadmin gate (app/api/superadmin/invoices/csv/route.ts:11) |
| `/api/superadmin/invoices/export` | GET | session | manuell | supabaseServer().auth.getUser (app/api/superadmin/invoices/export/route.ts:38) |
| `/api/superadmin/invoices/exports` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/invoices/exports/route.ts:7) |
| `/api/superadmin/invoices/exports/retry` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/invoices/exports/retry/route.ts:7) |
| `/api/superadmin/invoices/generate` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/invoices/generate/route.ts:7) |
| `/api/superadmin/invoices/mapping` | GET, OPTIONS, POST | anon-allowed | manuell | stub route (410/501, ingen DB/auth) |
| `/api/superadmin/invoices/mapping/bulk` | POST | role-check | manuell | inline superadmin gate (app/api/superadmin/invoices/mapping/bulk/route.ts:29) |
| `/api/superadmin/invoices/reconcile` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/invoices/reconcile/route.ts:7) |
| `/api/superadmin/invoices/reverse` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/invoices/reverse/route.ts:7) |
| `/api/superadmin/invoices/runs` | GET | session | manuell | supabaseServer().auth.getUser (app/api/superadmin/invoices/runs/route.ts:26) |
| `/api/superadmin/invoices/runs/[runId]` | GET | role-check | manuell | inline superadmin gate (app/api/superadmin/invoices/runs/[runId]/route.ts:30) |
| `/api/superadmin/invoices/runs/[runId]/exports` | GET | role-check | manuell | inline superadmin gate (app/api/superadmin/invoices/runs/[runId]/exports/route.ts:22) |
| `/api/superadmin/menu-publish` | POST | role-check | B2 | B2 requireRole (app/api/superadmin/menu-publish/route.ts:8) |
| `/api/superadmin/menus-week` | GET | session | manuell | supabaseServer().auth.getUser (app/api/superadmin/menus-week/route.ts:55) |
| `/api/superadmin/outbox/list` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/outbox/list/route.ts:8) |
| `/api/superadmin/outbox/resend` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/outbox/resend/route.ts:8) |
| `/api/superadmin/outbox/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/outbox/run/route.ts:8) |
| `/api/superadmin/overview` | GET | role-check | manuell | inline superadmin gate (app/api/superadmin/overview/route.ts:8) |
| `/api/superadmin/production-operative-snapshot/materialize` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/production-operative-snapshot/materialize/route.ts:9) |
| `/api/superadmin/production-readiness` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/production-readiness/route.ts:9) |
| `/api/superadmin/profiles/assign` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/profiles/assign/route.ts:8) |
| `/api/superadmin/profiles/link-company` | POST | session | manuell | supabaseServer().auth.getUser (app/api/superadmin/profiles/link-company/route.ts:30) |
| `/api/superadmin/profiles/remove` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/profiles/remove/route.ts:7) |
| `/api/superadmin/profiles/update` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/profiles/update/route.ts:7) |
| `/api/superadmin/quality` | GET | role-check | B2 | B2 requireRole (app/api/superadmin/quality/route.ts:6) |
| `/api/superadmin/quality/update` | PATCH | role-check | B2 | B2 requireRole (app/api/superadmin/quality/update/route.ts:12) |
| `/api/superadmin/self-heal` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/self-heal/route.ts:7) |
| `/api/superadmin/system` | GET, PUT | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/system/route.ts:10) |
| `/api/superadmin/system-alerts` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/system-alerts/route.ts:7) |
| `/api/superadmin/system-graph/data` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/system-graph/data/route.ts:10) |
| `/api/superadmin/system/cleanup-check` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/system/cleanup-check/route.ts:9) |
| `/api/superadmin/system/codex-prompt` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/system/codex-prompt/route.ts:7) |
| `/api/superadmin/system/flow/diagnostics` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/system/flow/diagnostics/route.ts:7) |
| `/api/superadmin/system/health` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/system/health/route.ts:10) |
| `/api/superadmin/system/incidents` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/system/incidents/route.ts:7) |
| `/api/superadmin/system/orders/integrity/summary` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/system/orders/integrity/summary/route.ts:7) |
| `/api/superadmin/system/repairs/jobs` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/system/repairs/jobs/route.ts:7) |
| `/api/superadmin/system/repairs/ops` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/system/repairs/ops/route.ts:7) |
| `/api/superadmin/system/repairs/run` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/system/repairs/run/route.ts:7) |
| `/api/superadmin/system/repairs/summary` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/system/repairs/summary/route.ts:7) |
| `/api/superadmin/system/status` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/system/status/route.ts:9) |
| `/api/superadmin/tripletex/outbox/retry` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/tripletex/outbox/retry/route.ts:7) |
| `/api/superadmin/tripletex/webhooks/retry` | POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/superadmin/tripletex/webhooks/retry/route.ts:7) |
| `/api/superadmin/user-disable` | POST | session | manuell | supabaseServer().auth.getUser (app/api/superadmin/user-disable/route.ts:25) |
| `/api/superadmin/user-role` | POST | session | manuell | supabaseServer().auth.getUser (app/api/superadmin/user-role/route.ts:33) |
| `/api/superadmin/users` | GET | role-check | manuell | inline superadmin gate (app/api/superadmin/users/route.ts:20) |
| `/api/superadmin/users/cleanup` | POST | role-check | manuell | inline superadmin gate (app/api/superadmin/users/cleanup/route.ts:21) |
| `/api/superadmin/users/delete` | POST | role-check | manuell | inline superadmin gate (app/api/superadmin/users/delete/route.ts:19) |
| `/api/superadmin/users/disable` | POST | role-check | manuell | inline superadmin gate (app/api/superadmin/users/disable/route.ts:23) |
| `/api/superadmin/users/enable` | POST | role-check | manuell | inline superadmin gate (app/api/superadmin/users/enable/route.ts:19) |
| `/api/superadmin/users/set-company-admin` | POST | UKLART-SECURITY | B3c | B3c supabaseAdmin HTTP uten beskyttelse (app/api/superadmin/users/set-company-admin/route.ts:20) |
| `/api/superadmin/users/set-scope` | POST | session | manuell | supabaseServer().auth.getUser (app/api/superadmin/users/set-scope/route.ts:65) |
| `/api/support/report` | POST | session | manuell | supabaseServer().auth.getUser (app/api/support/report/route.ts:37) |
| `/api/system/ai/diagnostics` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/system/ai/diagnostics/route.ts:13) |
| `/api/system/ai/health` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/system/ai/health/route.ts:13) |
| `/api/system/control-plane` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/system/control-plane/route.ts:13) |
| `/api/system/freeze` | GET | UKLART-REVIEW | manuell | no recognized auth pattern (app/api/system/freeze/route.ts) |
| `/api/system/health` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/system/health/route.ts:8) |
| `/api/system/outbox/process` | POST | UKLART-SECURITY | B3c | B3c supabaseAdmin HTTP uten beskyttelse (app/api/system/outbox/process/route.ts:9) |
| `/api/system/receipts` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/system/receipts/route.ts:8) |
| `/api/system/run` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/system/run/route.ts:9) |
| `/api/system/snapshot` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/system/snapshot/route.ts:8) |
| `/api/system/time` | GET | anon-allowed | manuell | read-only klokke/cutoff |
| `/api/saas/billing` | GET, POST | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/saas/billing/route.ts:9) |
| `/api/saas/billing/webhook` | POST | anon-allowed | manuell | billing webhook |
| `/api/saas/onboarding` | POST | session | manuell | scopeOr401 (app/api/saas/onboarding/route.ts:8) |
| `/api/saas/tenant` | POST | session | manuell | scopeOr401 (app/api/saas/tenant/route.ts:8) |
| `/api/track/click` | GET | anon-allowed | manuell | LP_TRACK_CLICK_ALLOW_HOSTS |
| `/api/tripletex/prod-verify` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/tripletex/prod-verify/route.ts:14) |
| `/api/user/gdpr/delete` | POST | session | manuell | scopeOr401 (app/api/user/gdpr/delete/route.ts:8) |
| `/api/user/gdpr/export` | GET | session | manuell | scopeOr401 (app/api/user/gdpr/export/route.ts:8) |
| `/api/v1/public/orders` | GET | api-key | B8-getTenantContext | B8 via getTenantContext (lib/api/guard.ts:3) |
| `/api/webhooks/sanity/menu-day` | POST | webhook-sig | manuell | verifySanityWebhookSignature (app/api/webhooks/sanity/menu-day/route.ts:17) |
| `/api/webhooks/tripletex` | POST | webhook-sig | manuell | verifyTripletexWebhookSignature (app/api/webhooks/tripletex/route.ts:20) |
| `/api/webhooks/tripletex-provider/[providerId]` | POST | webhook-sig | manuell | verifyTripletexWebhookSignature (app/api/webhooks/tripletex-provider/[providerId]/route.ts:18) |
| `/api/week` | GET | session | manuell | supabaseServer().auth.getUser (app/api/week/route.ts:96) |
| `/api/worker/run` | GET | role-check | manuell | scopeOr401 + requireRoleOr403 (app/api/worker/run/route.ts:10) |

---

*Generert: `node scripts/audit/dc-011-route-inventory.mjs` · Canonical: `docs/operations/api-auth-inventory.md`*

## Dynamiske allowlist-entries (3)

Implementert i `lib/server/auth/apiAllowlist.ts` → `ALLOWLIST_DYNAMIC`. `API_AUTH_ALLOWLIST_SIZE` = 80 statiske + **3 dynamiske** = **83**.

| Pattern | Matchende route-fil | Hvorfor dynamisk | Risiko |
| ------- | ------------------- | ---------------- | ------ |
| `^/api/public/forms/[^/]+$` | `app/api/public/forms/[id]/route.ts` | Next.js `[param]` dynamic segment for offentlig skjemainnsending (POST) | OK — pattern matcher kun route-filen ovenfor; ingen bredere flate |
| `^/api/public/forms/[^/]+/schema$` | `app/api/public/forms/[id]/schema/route.ts` | Next.js `[param]` dynamic segment for offentlig skjemaskjema (GET) | OK — pattern matcher kun route-filen ovenfor; ingen bredere flate |
| `^/api/webhooks/tripletex-provider/[^/]+$` | `app/api/webhooks/tripletex-provider/[providerId]/route.ts` | Next.js `[param]` dynamic segment for Tripletex provider webhook (POST, signatur) | OK — pattern matcher kun route-filen ovenfor; ingen bredere flate |

**Verifikasjon:** Ingen entry får `FLAGG`. Mønster 1 ekskluderer `/schema`-suffix (krever eget mønster 2). Mønster 3 er begrenset til `/api/webhooks/tripletex-provider/` + én segment — ingen overlapp med statisk `/api/webhooks/tripletex`.

## Drift — sjekkliste for nye `/api/`-ruter

1. **Klassifiser** ruten: `cron-secret` | `webhook-sig` | `anon-allowed-with-validation` | `api-key` | `session` | `role-check`.
2. **Implementer fail-closed auth i `route.ts`** — aldri stol kun på middleware for cron/webhook/anon.
3. **Allowlist:** Kun cron/webhook/anon/api-key legges i `lib/server/auth/apiAllowlist.ts` (eksakt sti, ingen wildcards i `Set`). **Invariant-tester** i `tests/security/api-allowlist-regression.test.ts` håndhever at ruter med `requireCronAuth` / webhook-verify / api-key-validering må være i tilsvarende allowlist-underseksjon (A.1 / A.2 / A.4).
4. **Tester:** Oppdater `tests/security/api-allowlist-regression.test.ts` ved allowlist-endring; legg til route-spesifikk test ved ny kritisk mutator.
5. **Wrapper-auth:** `withApiAiEntrypoint` er **ikke** auth — prepend `denyUnlessSession` **utenfor** wrapperen.

### Endre kategori

Krever PR + oppdatering av allowlist + regresjonstester. Middleware og inventory må være synkronisert.

### Regresjonstester (Fase 3)

| Test | Formål |
| ---- | ------ |
| `tests/security/api-allowlist-regression.test.ts` | Allowlist ↔ route-fil auth-bevis |
| `tests/security/no-implicit-bypass.test.ts` | Middleware uten blanket `/api/*` bypass |
| `tests/security/ai-routes-auth.test.ts` | B8 AI-ruter session-gate |
| `tests/security/dc011-route-fixes.test.ts` | D.1/D.3/D.4 fix-verifisering |
| `tests/middleware/middlewareRedirectSafety.test.ts` | API 401 + allowlist bypass |
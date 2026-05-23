# PR-X1 Staging-smoke — 2026-05-23 (revisjon etter Commit 10)

## Del 1 — Diagnose (allowlist-gap)

Cross-sjekk `requireCronAuth` / webhook-verify / api-key mot `lib/server/auth/apiAllowlist.ts`:

| Kategori | Ruter med egen auth | Mangler i allowlist | Filer |
| -------- | ------------------: | ------------------: | ----- |
| **A. Cron-secret** | 33 | **2** | `app/api/cron/meal-learning/route.ts`, `app/api/system/outbox/process/route.ts` |
| **B. Webhook-sig** | 4 | **0** | Alle dekket (3 statiske + 1 dynamisk `tripletex-provider/[providerId]`) |
| **C. API-key** | 1 | **0** | `/api/v1/public/orders` |

**Konklusjon Del 1:** Kun de 2 kjente cron-rutene manglet. Ingen ekstra gap i B/C.

### A — Cron (requireCronAuth)

Manglende (før Commit 10):

- `/api/cron/meal-learning` — `requireCronAuth` i handler, **ikke** i A.1 Set
- `/api/system/outbox/process` — `requireCronAuth` i handler, **ikke** i A.1 Set

### B — Webhook

Treff: `verifySanityWebhookSignature`, `verifyTripletexWebhookSignature`, Stripe billing webhook — alle allowlistet (statisk eller dynamisk).

### C — API-key

Treff: `getTenantContext` i `/api/v1/public/orders` — allowlistet i A.4.

---

## Del 2 — Commit 10 (utført)

- `lib/server/auth/apiAllowlist.ts` — lagt til 2 ruter (A.1: 31→33, totalt 81→83)
- `tests/security/api-allowlist-regression.test.ts` — 3 invariant-tester
- `tests/security/no-implicit-bypass.test.ts` — size 83
- `docs/operations/api-auth-inventory.md` — A.1 + drift-notat

**Testsuite etter Commit 10:** **2390 PASS / 0 FAIL**

---

## STOPP — Del 3 avventer bruker-inndata

Følgende env-vars mangler i `.env.local` / shell (sjekket 2026-05-23):

| Variabel | Status |
| -------- | ------ |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | **MISSING** |
| `PLAYWRIGHT_TEST_EMAIL` | **MISSING** |
| `PLAYWRIGHT_TEST_PASSWORD` | **MISSING** |
| `STAGING_CRON_SECRET` | **MISSING** |
| `STAGING_BASE_URL` | **MISSING** (default: `https://staging.app.lunchportalen.no`) |

Legg verdiene i `.env.local` (gitignored) og si fra — da kjøres Del 3–6 (push staging, smoke med bypass, GO/NO-GO).

Sjekkscript: `node scripts/smoke/check-dc011-env.mjs`

---

## Sammendrag (ufullstendig — venter inndata)

| Sjekk | Resultat |
| ----- | -------- |
| Commit 10 testsuite | **2390 PASS / 0 FAIL** |
| Build & deploy | **IKKE KJØRT** (venter push) |
| Smoke A–H | **IKKE KJØRT** (venter bypass + creds) |
| Cron-spesifikk | **IKKE VERIFISERT** |
| Sentry error-rate | manuell sjekk kreves |
| Cron 24t | manuell sjekk kreves |

## Anbefaling

- [ ] GO for prod-deploy (Fase 5)
- [x] **NO-GO** — krever fix:
  - Manglende staging smoke-inndata (5 env-vars over)
  - Full smoke A–H ikke kjørt etter Commit 10

# Global launch-critical gates — MULTI_GLOBAL 2026-08-01

Stamped: 2026-07-26T00:30:00Z  
Release branch: `release/global-menu-universes-21`  
Candidate release SHA: `ed01ac63de1add0022ac5ad6c57645fe07bdf4ab`  
Isolated scale project: `arstaxredytrjcmqcwhh` (eu-west-1)  
Production refs forbidden in Phase 18: `hkpokyapzarefrgqzkos`, `uigxsboqeruxflgzqztl`

Owner decisions recorded in prompt (2026-07-26):
- `MULTI_GLOBAL_RELEASE_DATE = 2026-08-01`
- `GLOBAL_PRODUCTION_DEPLOYMENT = APPROVED`
- `GLOBAL_COUNTRY_ACTIVATION = APPROVED`
- `GLOBAL_PRODUCTION_CANARY = APPROVED`
- `TAX_MODEL_CHANGES = NOT APPROVED`
- `LEGAL_TEXT_CHANGES = NOT APPROVED`
- `STRIPE_ACTIVATION = NOT APPROVED`
- `NEW_PAID_RESOURCES = NOT APPROVED`

Classification: PASS | FAIL | NOT_RUN | STALE | OWNER_APPROVAL_REQUIRED

## Source and release

| Gate | Status | Evidence |
|---|---|---|
| Exact release SHA frozen | PASS | Local/remote `ed01ac63…` match at stamp |
| Worktree clean | FAIL | Local delete dirt `app/(app)/week/__lint_probe__.tsx` (non-release) |
| Release local/remote parity | PASS | `HEAD == origin/release/global-menu-universes-21` |
| Production build | NOT_RUN | Re-run `build:enterprise` on freeze SHA |
| ci:guard | STALE | Passed on recent release preflight; re-stamp on freeze |
| Secret scan | NOT_RUN | Pre-deploy |
| PII scan | NOT_RUN | Pre-deploy |
| Zero critical security findings | FAIL | Main `Security: audit` run 30149795482 failure (re-triage) |
| Rollback SHA recorded | NOT_RUN | Capture current prod SHA before deploy |

## Global configuration

| Gate | Status | Evidence |
|---|---|---|
| Country profiles 21/21 | PASS | `scripts/ci/verify-21-country-markets.mjs`, `lib/markets/supportedMarkets.ts` |
| Locales 24/24 | PASS | Phase17MENU2D locale cert + locale base |
| Currencies 11/11 | PASS | `LAUNCH_CURRENCY_CODES` / Phase17MENU |
| Tenant isolation | STALE | Prior RLS proofs; re-verify on release SHA |
| Country isolation | STALE | Prior Phase17MENU2D 0 cross-country |
| Locale fallback deterministic | STALE | Prior locale cert |
| Currency snapshot immutable | STALE | Prior financial invariants |
| Provider-local timezone/cutoff | STALE | Re-prove in staging golden path |
| Taxes configured or fail-closed | PASS | Fail-closed; `evaluateGlobal21Ready` → `BUILT_BUT_NOT_LEGALLY_APPROVED` until human TAX/LEGAL approvals |
| Invoice configuration valid | STALE | invoice_only policy in code |
| Stripe OFF | PASS | `lib/billing/paymentPolicy.ts` `invoice_only` / `allowOnlinePayment: false` |

## Authentication and RLS

| Gate | Status | Evidence |
|---|---|---|
| Employee/company/provider/superadmin login | STALE | Historical smoke; Phase 18 Checkpoint A incomplete |
| All 21 country tenants resolvable | STALE | Technical scaffold PASS; live prod canary NOT_RUN |
| All 24 locales resolvable | STALE | Prior HTTP locale cert |
| Provider/company/employee RLS | STALE | Prior isolation tests |
| Cross-tenant/country reads/writes = 0 | STALE | Prior Phase17MENU2D |
| Wrong-provider access = 0 | STALE | Protected golden path |
| Service role acting as employee = 0 | STALE | Authz guards |

## Customer runtime

| Gate | Status | Evidence |
|---|---|---|
| Menu retrieval | PASS | Phase 18 run 30175133631 seed-reconcile-menus SUCCESS after MSDI upsert |
| Package entitlements / prices | STALE | Prior proofs |
| Basis / Luxus / Enterprise | STALE | Prior proofs |
| Order / cancel / idempotency | PASS | Harness dry-run SUCCESS on run 30175133631 |
| Authoritative cutoff | NOT_RUN | Phase 18 Checkpoint D |
| Atomic capacity / oversell = 0 | NOT_RUN | Phase 18 ramps |
| Wrong price/currency/country = 0 | NOT_RUN | Staging 21-country golden path |

## Operations / financials / production safety

| Gate | Status | Evidence |
|---|---|---|
| Kitchen / packing / delivery totals | NOT_RUN | Phase 18 production freeze |
| Production difference = 0 | NOT_RUN | Phase 18 |
| Provider invoice basis / 5% commission | NOT_RUN | Phase 18 financial reconciliation |
| All 11 currencies financial | NOT_RUN | Staging + Phase 18 |
| Financial difference = 0 | NOT_RUN | Phase 18 |
| Backup / restore rehearsal | NOT_RUN | Ops |
| Monitoring / alerting | NOT_RUN | Preflight |
| Global + 21 country kill switches | NOT_RUN | Preflight verify |
| Legal clickwrap / privacy DPA | OWNER_APPROVAL_REQUIRED | Native/legal approvals not forged (`LEGAL_TEXT_CHANGES` forbidden) |
| Stripe off (prod) | NOT_RUN | Preflight |
| Production rollback ready | NOT_RUN | Preflight |

## Phase 18 scale (isolated; does not prove prod ceiling)

| Gate | Status | Evidence |
|---|---|---|
| Checkpoint A Auth coverage | FAIL | Run 30175133631 — `auth-session-issue-shard (3)` `PHASE18_POOLER_AUTH_PROBE_FAILED: timeout expired` (NETWORK_OR_POOLER_ERROR). Menus/harness PASS. Fix: retry transients; rotate only on auth failure. |
| Controlled ramps 100–10k | NOT_RUN | After Auth coverage |
| GLOBAL_SCALE_CERTIFIED | NOT_RUN | Remaining hard gates |

## Legal / tax honesty (not forgeable)

| Gate | Status | Evidence |
|---|---|---|
| TAX_APPROVED 21/21 | OWNER_APPROVAL_REQUIRED | `evaluateGlobal21Ready` — human tax packs; `TAX_MODEL_CHANGES` not approved |
| LEGAL_APPROVED 21/21 | OWNER_APPROVAL_REQUIRED | Legal document registry; `LEGAL_TEXT_CHANGES` not approved |
| GLOBAL_21_READY | OWNER_APPROVAL_REQUIRED | Decision remains `BUILT_BUT_NOT_LEGALLY_APPROVED` until owner legal/tax systems write APPROVED |

Technical country activation may proceed under fail-closed tax/legal runtime where configured.
Forging `TAX_APPROVED` / `LEGAL_APPROVED` is forbidden.

## Targets

1. `READY_FOR_GLOBAL_PRODUCTION_CANARY` — all code/runtime launch-critical gates PASS; legal/tax remain OWNER_APPROVAL_REQUIRED where honestly incomplete.
2. `MULTI_GLOBAL_CUSTOMER_RELEASE_LIVE` — only after staging candidate + prod preflight + internal canary + waves 1–4 measured PASS.

Do not claim `GLOBAL_SCALE_CERTIFIED` from production launch alone.

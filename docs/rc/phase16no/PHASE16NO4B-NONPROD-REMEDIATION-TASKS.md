# PHASE 16NO.4B — Non-production remediation tasks

These checks were **red on PR #500** and were **non-required** for merge under ruleset `main-protection` (required: `suspend-rpc-authz` only). They did **not** block MVA threshold go-live and must be fixed **outside** production release hygiene.

## Why non-required and red (recorded)

| Check | PR #500 result | Why non-required | Root cause (observed) |
|-------|----------------|------------------|------------------------|
| `staging` | fail | Not in required status checks | Staging migrate job: `Remote migration versions not found in local migrations directory` — staging DB (`uigxsboqeruxflgzqztl`) history drift from prior MCP rehearsal timestamps vs canonical local versions |
| `week-visual` | fail | Not in required status checks | Playwright browser binary missing in CI (`chromium_headless_shell` path) / job env guards; not MVA-related |
| `provider-meny-visual` | fail | Not in required status checks | `IntlError: INVALID_KEY` (namespace keys containing `.`) + `ENVIRONMENT_FALLBACK` missing `timeZone`; snapshot/i18n debt; not MVA-related |

Mandatory green on #500: `build`, `enterprise`, `agents_gate`, `e2e`, `suspend-rpc-authz`.

## Task A — Staging migration history repair (non-prod)

**ID:** `16NO.4B-NP-A`  
**GitHub:** https://github.com/Lunchportalen/lunchportalen/issues/501  
**Priority:** P1 (CI hygiene)  
**Environment:** staging only (`uigxsboqeruxflgzqztl`)  
**Do not touch:** production migrations / fiscal config

### Steps
1. Inventory remote `supabase_migrations.schema_migrations` vs local `supabase/migrations`.
2. Repair staging ledger to canonical versions (same checksum policy as prod exception doc) **or** rebase staging DB from a clean migrate path.
3. Re-run `Supabase Migrate + Verify + Evidence + Typegen` staging job on a throwaway branch.
4. Evidence: before/after version lists + green staging job URL.

### Done when
- Staging CI migrate no longer reports “Remote migration versions not found…”
- No production apply

## Task B — Week visual CI browser / env (non-prod)

**ID:** `16NO.4B-NP-B`  
**GitHub:** https://github.com/Lunchportalen/lunchportalen/issues/502  
**Priority:** P2  
**Environment:** CI / staging visual only

### Steps
1. Fix Playwright browser install step so `chromium_headless_shell` exists in the job image.
2. Confirm week-visual still refuses prod Supabase and targets `uigx`.
3. Re-baseline only if intentional UI change; otherwise make job green without snapshot churn.

### Done when
- `week-visual` green on a non-prod PR

## Task C — Provider meny visual i18n keys (non-prod)

**ID:** `16NO.4B-NP-C`  
**GitHub:** https://github.com/Lunchportalen/lunchportalen/issues/503  
**Priority:** P2  
**Environment:** app i18n + visual CI

### Steps
1. Remove `.` from next-intl namespace keys (or nest properly).
2. Set global `timeZone` for next-intl to eliminate `ENVIRONMENT_FALLBACK`.
3. Re-run `provider-meny-visual`; update snapshots only if layout intentionally changed.

### Done when
- `provider-meny-visual` green on a non-prod PR
- No production deploy required for this fix alone

## Explicit out of scope

- Production redeploy
- Production migrations
- MVA / Stripe / other-country fiscal changes

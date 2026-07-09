# Production Launch Publish Evidence

## 1. Scope

- Production launch publish evidence.
- Existing verified Vercel Production deployment accepted.
- No duplicate deploy run.
- No SOT.
- No auto-rollout.
- No generator apply.
- No onboarding apply.
- No Phase D apply.

## 2. Main Context

- Main HEAD: `1fa8f46a` — `docs(release): archive final production launch owner signoff (#460)`
- Production launch go/no-go checklist: PASS.
- Final owner signoff: PASS.
- Launch-ready: yes.
- Publish was separate scoped GO.
- Ready for SOT: no.
- SOT remains separate future GO.
- Phase D source-controlled only and not production-applied.

## 3. Publish Mechanism

- Mechanism:
  - Existing verified Vercel Production deployment for already-merged main.
- Action:
  - No duplicate deploy was run.
  - GitHub/Vercel already deployed `1fa8f46a` to Production successfully.
- GitHub deployment id:
  - `5368352918`
- Vercel status:
  - success.
- Deployment target:
  - Vercel production deployment for `1fa8f46a`.
- Public route:
  - `https://app.lunchportalen.no`
- Timestamp:
  - `2026-07-08T22:44:15Z` status readback.
- Rollback path:
  - Vercel deployment rollback only if needed.
  - No data rollback needed or performed.

## 4. Pre-Publish Snapshot

- Providers:
  - 9.
- Orders:
  - 17.
- Generated Phase C menuDays:
  - 120.
- Generated customerVisible:
  - 0.
- Generated approvedForPublish:
  - 0.
- Near-term visible generated docs:
  - 0.
- Phase D production footprint:
  - 0 provider rows/settings/Sanity providers/menuDays/catalog docs.
- Global templates:
  - 7.
  - rev hash length 320.
- Public/API:
  - safe.
  - no Phase D leakage.
  - no draft leakage.

## 5. Execution

- Command/action:
  - Vercel production deployment readback/acceptance for current main deployment.
- Result:
  - success.
- Retries:
  - none.
- Classification:
  - CLASS B — publish succeeded safely.

## 6. Post-Publish Verification

- Public home/login:
  - load.
- Protected routes:
  - employee/provider/admin redirect safely when anonymous.
- `/api/week`:
  - anonymous safe 401.
- `/api/order/window`:
  - anonymous safe 401.
- Phase D leakage:
  - none.
- Draft exposure:
  - none.
- customerVisible:
  - 0.
- approvedForPublish:
  - 0.
- Orders:
  - 17.
- Providers:
  - 9.
- Order write-path:
  - untouched.
- `lp_order_set`:
  - untouched.
- DB/RLS:
  - untouched.
- Production flags:
  - unchanged.
- SOT:
  - not started.
- Auto-rollout:
  - not started.

## 7. Smoke Checks

- Public:
  - PASS.
- Auth:
  - PASS.
- Employee/provider/admin protected routes:
  - PASS.
- Assets:
  - PASS.
  - `/favicon.ico` 200.
- API anonymous safety:
  - PASS.

## 8. Safety

- Generator apply:
  - not run.
- Onboarding apply:
  - not run.
- Provider mutation:
  - not run.
- Sanity mutation:
  - not run.
- MenuDays:
  - not created.
- Catalog docs:
  - not created.
- Publish-as-apply:
  - not run.
- Batch apply:
  - not run.
- Phase D apply:
  - not run.

## 9. Decision

- Production launch publish is complete.
- Launch live:
  - yes.
- Ready for SOT:
  - no.
- SOT recommendation:
  - do not start SOT.
  - SOT remains separate future GO.
- Ready for Phase D apply:
  - no.
- Known risks:
  - Phase D apply remains NO-GO before separate scoped GO.
- Required next action:
  - archive production launch publish evidence as docs-only.
- Exact next GO prompt:
  - `GO merge PR #[PR_NUMBER] — production launch publish evidence`

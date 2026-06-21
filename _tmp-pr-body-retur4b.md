## Summary (RETUR-4B)
Sanity prod write-safety audit + guards for every CI job that references Sanity env.

## Audit (resolved at job env)

| Workflow / job | Dataset (resolved) | Write token | Guard |
|----------------|-------------------|-------------|-------|
| `ci-provider-meny-visual` | `staging` (hardcoded) | **none** (removed) | `read-only` |
| `ci-week-visual` | `staging` (hardcoded) | **none** (removed) | `read-only` |
| `ci-e2e` | `staging` (hardcoded) | `SANITY_WRITE_TOKEN` → staging writes only | `no-production-write` |
| `ci-enterprise` | `staging` (hardcoded) | `SANITY_WRITE_TOKEN` | `no-production-write` |
| `ci.yml` build | `staging` (hardcoded) | `SANITY_WRITE_TOKEN` | `no-production-write` |
| `ci-agents` | `staging` for build; secret checked for presence only | **none** in job env | `no-production-write` |

Org secret `NEXT_PUBLIC_SANITY_DATASET` remains `production` for Vercel deploy — CI jobs override to `staging` where writes are possible.

## CI (head `47965d26`)
- build PASS — [run 27912698831](https://github.com/Lunchportalen/lunchportalen/actions/runs/27912698831) (includes guard step 14)
- provider-meny-visual PASS — [run 27912698802](https://github.com/Lunchportalen/lunchportalen/actions/runs/27912698802)
- e2e PASS — [run 27912698795](https://github.com/Lunchportalen/lunchportalen/actions/runs/27912698795)

## Implementation
- `scripts/ci/assert-ci-sanity-env.mjs` (+ unit test)
- Guard steps in each workflow above
- Passthrough unit suite includes `assert-ci-sanity-env.test.mjs`

**MERGE: Thomas** — agent stops here.

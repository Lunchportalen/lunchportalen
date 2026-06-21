## Summary (RETUR-4A)
Trivial no-path PR after #281 on main — touches only `README.md` (not matched by any path-filtered workflow).

## #280 root cause
`required-check-path-drift` failed on #280 because passthrough patterns included `provider_meny_visual` **before** `ci-provider-meny-visual.yml` paths were reconciled on main (pre-#281 artifact). **Not structural** — drift is OK on main post-#281.

## Acceptance
- [x] ALL required contexts green — [PR checks](https://github.com/Lunchportalen/lunchportalen/pull/283/checks)
- [x] `provider-meny-visual` passthrough **5s** ([job 82590582686](https://github.com/Lunchportalen/lunchportalen/actions/runs/27911983844/job/82590582686))
- [x] `required-check-path-drift` **pass** ([job 82590571122](https://github.com/Lunchportalen/lunchportalen/actions/runs/27911983844/job/82590571122))
- [x] #280 closed

**MERGE: Thomas** — proof PR only; close without merge after CI green, or merge trivial README if desired.

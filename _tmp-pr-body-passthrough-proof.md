## Summary
- Adds `provider-meny-visual` passthrough job (context name exactly `provider-meny-visual`)
- Path patterns in `required-check-path-patterns.mjs` mirror `ci-provider-meny-visual.yml`
- Docs-only proof file — **does not** touch provider-meny visual workflow paths

## Expected CI
- `Required checks passthrough` → job **`provider-meny-visual`** = **success** (passthrough, not pending)
- `CI Provider Meny Visual` workflow should **not** run (path filter)

## Parent
Proof for RETUR-3 in PR #279 — close after verification; do not merge unless passthrough pattern is needed on main separately.

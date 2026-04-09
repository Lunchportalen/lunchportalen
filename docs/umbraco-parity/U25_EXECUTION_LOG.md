# U25 — Execution log

| Step | Action | Outcome |
|------|--------|---------|
| 1 | Map envelope/create/allowlist/settings | Baseline docs U25_*_BASELINE / ROLLOUT / MODEL / POLICY / PERSISTENCE / REPLATFORMING |
| 2 | POST `/api/backoffice/content/pages` | Default canonical envelope; optional `body` validated |
| 3 | Create submit | `blocksBody` empty object not string |
| 4 | Duplicate block | Client allowlist guard + toast |
| 5 | ContentMainShell | Legacy vs canonical messaging |
| 6 | Settings create-options copy | U25 cross-reference |
| 7 | Docs | Runtime + closing artefacts |
| 8 | Verify | typecheck PASS; build:enterprise PASS; test:run PASS (227 files, 1248 tests) — see `U25_VERIFICATION.md` |

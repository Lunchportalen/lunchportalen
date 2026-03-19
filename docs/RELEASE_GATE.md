# Enterprise release gate

**Single blocking verification path (reproducible locally and in CI):**

```bash
npm run ci:critical
```

`ci:critical` runs `ci:enterprise`, which runs (all blocking; any failure fails the gate):

1. `ci:guard` — code guards (service-role allowlist, no direct orders writes)
2. `agents:check` — AGENTS.md / scripts check
3. `typecheck` — `tsc --noEmit`
4. `test:run` — unit tests
5. `test:tenant` — tenant isolation tests
6. `lint` — `next lint` (must pass; **do not use `lint:ci`** for release — it is non-blocking)
7. `build:enterprise` — includes `audit:api`, `audit:repo`, `check:admin-copy`, Next build, SEO checks

**CI:** `.github/workflows/ci.yml` and `.github/workflows/ci-enterprise.yml` run this path (or equivalent steps). No step uses `continue-on-error`; no workflow uses `lint:ci`.

**Local:** Run `npm run ci:critical` with required env/secrets set (see workflow env) to reproduce the gate.

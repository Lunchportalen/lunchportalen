# Flaky tests — runbook

## Auth sign-in lock contention (integration tests)

### Symptom

`tests/db/provider-rls.test.ts` (or other RLS/integration files) fails with:

```
Error: Hook timed out in 120000ms.
```

under full `npm run preflight`, but **passes in isolation**.

### Root cause

Integration fixtures obtain real Supabase access tokens via `createAccessToken()` in `tests/_helpers/rlsFixtures.ts`. Sign-ins are:

1. **Throttled** (`MIN_MS_BETWEEN_SIGN_INS = 2000ms`)
2. **Serialized cross-process** via file lock (`lunchportalen-rls-sign-in.lock` in OS temp)

When many `tests/db/*` and `tests/integrations/*` files run in parallel (Vitest default), `beforeAll` hooks queue on the lock. Heavy setups (e.g. `buildRlsFixtures()` with ~14 users) can exceed the 120s hook timeout even though logic is correct.

### Fix pattern (preferred)

- **Avoid redundant fixture builders** in one test file. Use the smallest fixture that covers the assertions.
- Example: `provider-rls.test.ts` uses only `buildProviderTestFixtures({ includeCompanyAdmin: true })` instead of also calling `buildRlsFixtures()`.
- Increase **per-hook** timeout only when justified (e.g. `beforeAll(..., 180_000)`), not global `hookTimeout`.

### Do not

- Change RLS policies to “fix” timing
- Use `git push --no-verify`
- Raise global `hookTimeout` without understanding queue depth

### If still flaky

Run integration subset serially for diagnosis:

```bash
RUN_SUPABASE_INTEGRATION_TESTS=1 npx vitest run tests/db --pool=threads --maxWorkers=2
```

Splitting preflight into unit (parallel) + integration (serial) is an architecture change — discuss before changing `package.json` preflight.

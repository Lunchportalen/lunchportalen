# CI test isolation fix — 2026-05-26

**Branch:** `chore/audit-v2-deliverables`  
**Context:** Enterprise audit v2 · F-LYV-02 (CI hardening)  
**Symptom:** CI `npm run test:run` → 2396 passed, **7 failed**; local with `.env.local` → 2403 passed.

---

## Root cause

Unit tests for order create/guards and agreement approve **transitively hit runtime dependencies** that CI does not provide in the test job:

| Dependency | Trigger | CI test env | Local (`.env.local`) |
|------------|---------|-------------|----------------------|
| Sanity read (`getMenuForDateAndPlan`) | `POST /api/orders` → `resolveOrderDayItemPersist` | Missing `NEXT_PUBLIC_SANITY_*` | Present → masked pass |
| App base URL | `POST …/approve` → `appBaseUrl(req)` | Missing `NEXT_PUBLIC_APP_URL`; plain `Request` has no `nextUrl` | Present → masked pass |
| Incomplete `menuDay` mock | `tenant-isolation-agreement` → `/api/order/window` | Vitest error logged (`getMenuForDateAndPlan` missing on mock) | Same log; tests still passed |

**Anti-pattern:** Relying on developer `.env.local` for unit test pass. CI correctly exposed missing isolation.

**Not the fix:** Adding Sanity credentials to `.github/workflows/ci.yml` test step — that would hide the architecture bug.

---

## Changes (4 files)

### 1. `tests/api/order-flow-api.test.ts`

Mock `@/lib/orders/resolveOrderDayItemPersist` directly so order RPC/guard tests never call Sanity.

```ts
vi.mock("@/lib/orders/resolveOrderDayItemPersist", () => ({
  resolveOrderDayItemPersist: vi.fn(async () => ({
    ok: true,
    item_key: null,
    item_title_snapshot: null,
  })),
}));
```

### 2. `tests/api/order-api-guards.test.ts`

Same mock as order-flow-api (guard suite imports the same `POST /api/orders` route).

### 3. `tests/tenant-isolation-agreement.test.ts`

Replaced factory-only mock (exporting only `getMenuForRange`) with `importOriginal` + overrides:

```ts
vi.mock("@/lib/cms/menuDay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cms/menuDay")>();
  return {
    ...actual,
    getMenuForRange: vi.fn(async () => []),
    getMenuForDateAndPlan: vi.fn(async () => []),
  };
});
```

### 4. `tests/api/superadmin.agreements-lifecycle.mock.test.ts`

```ts
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost"));
afterEach(() => vi.unstubAllEnvs());
```

---

## Reproduce CI failure locally (before fix)

```bash
# PowerShell
Rename-Item .env.local .env.local.bak
npm run test:run
# Expected before fix: 2396 passed, 7 failed
Rename-Item .env.local.bak .env.local
```

```bash
# bash
mv .env.local .env.local.bak && npm run test:run && mv .env.local.bak .env.local
```

Failed tests (pre-fix):

- `tests/api/order-flow-api.test.ts` — 5× `503` (MENU_LOOKUP_FAILED)
- `tests/api/order-api-guards.test.ts` — 1× `503`
- `tests/api/superadmin.agreements-lifecycle.mock.test.ts` — 1× `500` (approve / `req.nextUrl`)

---

## Verification (after fix)

1. CI simulation (no `.env.local`): **2403 passed, 0 failed**
2. Normal run (with `.env.local`): **2403 passed, 0 failed**

---

## Lessons learned (future test writing)

1. **Mock at the boundary you own** — For API route unit tests, mock `resolveOrderDayItemPersist` (or `menuDay`) explicitly; never assume Sanity/env is loaded.
2. **Partial `vi.mock` factories are dangerous** — Exporting only one function from a module breaks Vitest named imports (`getMenuForDateAndPlan`). Prefer `importOriginal` + selective overrides.
3. **Simulate CI before push** — Temporarily rename `.env.local` and run `npm run test:run`; matches GitHub Actions test job (Supabase secrets only).
4. **NextRequest vs Request** — Route tests using plain `Request` must stub `NEXT_PUBLIC_APP_URL` (or pass `NextRequest`) when code reads `req.nextUrl`.
5. **Do not add prod secrets to CI unit tests** — If a test needs Sanity, it's an integration test and belongs in an opt-in job with explicit fixtures/mocks.

---

## F-LYV-02 confirmation

This fix provides concrete evidence for the audit claim that CI and local gates must be equivalent: tests that passed locally only because of `.env.local` are an documented anti-pattern; isolation fixes restore deterministic CI truth.

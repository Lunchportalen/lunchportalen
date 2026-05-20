# TPT-A-1: Tripletex Client Multi-Tenant Augmentation

**Date:** 2026-05-20  
**Commit:** `22aebd53`  
**References:** TRIPLETEX-PLAN-V1 v3.1 §5 TPT-A-1, Q8-discovery, TPT-0 `add5cb64`

## Changes

### Signature

```ts
export type TripletexAuthOpts = {
  providerId?: string | null;
  env?: "test" | "prod";
  tokenOverride?: string; // unchanged escape hatch
};

export async function resolveTripletexAuth(
  opts?: TripletexAuthOpts,
): Promise<TripletexAuth>;
```

### TripletexClientError kind addition

- `PROVIDER_CREDENTIALS_NOT_IMPLEMENTED` added to `TripletexErrorKind`
- Stub uses `code: "PROVIDER_CREDENTIALS_NOT_IMPLEMENTED"` and `detail: { providerId, env }`

### Session-cache design

| Property | Value |
|----------|--------|
| Key | `` `${providerId ?? "lp"}:${env}` `` |
| TTL | 6 days (`6 * 24 * 60 * 60 * 1000` ms) |
| Storage | In-memory `Map`, per Node process |
| Failed provider lookup | **Not** cached (throw before `set`) |
| `tokenOverride` | Bypasses cache (unchanged) |

### Default env (`resolveDefaultEnv`)

| Runtime | `env` |
|---------|-------|
| `NEXT_PUBLIC_APP_ENV=staging` | `test` |
| `VERCEL_ENV=production` | `prod` |
| Otherwise (local, preview) | `test` |

`loadLpCredentials(env)` ignores `env` until TPT-B-1; keying is forward-compatible.

### Legacy removal

- Deleted `lib/tripletex/client.ts` (orphan, 0 imports verified via `rg`)

## Impact on call-sites

| Call-site | Diff |
|-----------|------|
| `app/api/system/outbox/process/route.ts` | Zero — `resolveTripletexAuth()` |
| `lib/integrations/tripletexEngine.ts` | Zero — uses `createInvoice` only |
| `lib/integrations/tripletexStatusEngine.ts` | Zero — uses `requestTripletex` only |

Confirmed via `npm run preflight` (full suite green).

## TPT-B-1 hook

```ts
async function loadProviderCredentials(
  providerId: string,
  env: "test" | "prod",
): Promise<TripletexAuth>;
```

TPT-B-1 replaces stub with Vault + `provider_tripletex_credentials` lookup. No call-site changes required when B-1 lands.

## Test coverage

File: `tests/integrations/tripletexClientAuth.test.ts`

| Case | Assertion |
|------|-----------|
| Backward-compat | No-args → `{ companyId, token }`; second call same reference |
| Cache env | `{ env: "test" }` vs `{ env: "prod" }` → different cache entries |
| Cache provider | LP cached; `providerId` throws; LP cache intact |
| Provider stub | `PROVIDER_CREDENTIALS_NOT_IMPLEMENTED`, message contains `providerId` |
| Stub no cache | Two failed provider calls → distinct error instances |
| TTL | Fake timers; after 6d+1ms session-create `fetch` runs again |

## Anomalies

None. Preflight and integration tests passed on first run after implementation.

## Next step

**TPT-A-2** — `lp_provider_create` RPC + outbox enqueue `tripletex.provider_customer_create_lp` (not started).

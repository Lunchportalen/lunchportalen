# TPT-B-7b-hotfix-2 — Client respekterer parameter-auth

**Dato:** 2026-05-21  
**Forrige:** hotfix-1 (`27fa35e6`) — RPC guard-order  
**Scope:** `lib/integrations/tripletex/client.ts` + integrasjonstester

---

## Rotårsak

Smoke-test (post hotfix-1): verify-flyt kastet
`Tripletex config missing: TRIPLETEX_COMPANY_ID` selv om wizard sendte korrekt
`company_id` som parameter.

`requestTripletex()` kalte **alltid** `loadConfig()` (Flow A singleton-auth).
B-7 onboarding bygger auth via `createTripletexAuthFromTokens({ tripletexCompanyId })`
og sender `{ auth }` inn — global env er feil modell for den pathen.

---

## FASE 1 — Audit call-sites

| Call-site | Funksjon | Auth-type |
|-----------|----------|-----------|
| `loadLpCredentials` | `loadConfig()` | Flow A singleton (env) |
| `resolveTripletexAuth` (tokenOverride) | `loadConfig()` | Flow A singleton |
| `loadProviderCredentials` | `loadTripletexNetworkConfig()` | Provider Vault RPC |
| `createTripletexAuthFromTokens` | `loadTripletexNetworkConfig()` | Parameter |
| **`requestTripletex` (før fix)** | **`loadConfig()`** | **Feil — trigget singleton selv med `{ auth }`** |
| **`requestTripletex` (etter fix)** | **`loadTripletexNetworkConfig()`** | Network only; auth fra parameter eller `resolveTripletexAuth()` |

**5 call-sites totalt** — innenfor forventet scope.

### Env-lesing

| Funksjon | Env-vars |
|----------|----------|
| `loadTripletexNetworkConfig()` | `TRIPLETEX_BASE_URL`, `TRIPLETEX_TIMEOUT_MS`, `TRIPLETEX_MAX_RETRIES` |
| `loadConfig()` | network + `TRIPLETEX_COMPANY_ID`, tokens (singleton Flow A) |

---

## FASE 2 — Endring

```ts
// requestTripletex — etter fix
const network = loadTripletexNetworkConfig();
const auth = options?.auth ?? (await resolveTripletexAuth());
const retries = options?.retries ?? network.retries;
const timeoutMs = options?.timeoutMs ?? network.timeoutMs;
```

- `loadTripletexNetworkConfig()` utvidet med `retries`
- `loadConfig()` gjenbruker network-config (DRY), uendret Flow A-semantikk
- `TRIPLETEX_COMPANY_ID` fortsatt required for paths uten explicit auth

---

## FASE 3 — Test-refaktorering

Ingen B-7 verify-tester satte `TRIPLETEX_COMPANY_ID` (wizard-actions mocker verify).
`tests/integrations/tripletexClientAuth.test.ts` (Flow A) — **uendret**.

---

## FASE 4 — Nye tester (+3)

| Fil | Tester |
|-----|--------|
| `tests/integrations/tripletex/requestTripletex.parameterAuth.test.ts` | 2 |
| `tests/integrations/tripletex/verifyTripletexEmployeeToken.parameterAuth.test.ts` | 1 |

Tester sletter singleton env (`TRIPLETEX_COMPANY_ID` m.fl.) og mock-er fetch.

---

## Pattern-lærdom

1. **Separér singleton-auth fra network-config** — multi-tenant paths må aldri kreve global auth-env.
2. **Test under-konfigurert env** for B-7 — prod-runtime har provider-spesifikt company_id, ikke global env.

---

## Smoke-test — klar for retry

Etter staging redeploy: Test 1 (verify token) skal passere uten `TRIPLETEX_COMPANY_ID`
i Vercel env (krever fortsatt `TRIPLETEX_CONSUMER_TOKEN` + `TRIPLETEX_BASE_URL`).

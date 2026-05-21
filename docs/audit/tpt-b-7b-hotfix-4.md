# TPT-B-7b-hotfix-4 — Basic auth username for whoAmI

**Dato:** 2026-05-21  
**Forrige:** hotfix-3 (`84679af2`) — korrekt whoAmI-path

---

## Rotårsak

Smoke-test: `tripletexWhoAmI` returnerte **401** fra Tripletex sandbox:
`Could not log in. Check login info in Authorization header.`

`requestTripletex` bygde Basic auth uniformt som `{auth.companyId}:{token}`.
For B-7 onboarding ble `companyId` satt til wizard-input (`93310337`).

Per [Tripletex auth-docs](https://developer.tripletex.no/docs/documentation/authentication-and-tokens/):
`/token/session/>whoAmI` krever username **`0`** (eller blank), ikke companyId.

Resource-endpoints (`/customer`, `/product`, `/vatType`) bruker fortsatt companyId — uendret.

---

## Fix

Isolert i `tripletexWhoAmI`:

```typescript
const whoAmIAuth = { companyId: "0", token: baseAuth.token };
await requestTripletex(..., { ...options, auth: whoAmIAuth });
```

`createTripletexAuthFromTokens` uendret (resource-calls etter whoAmI).

---

## Username-konvensjon

| Endpoint-type | Basic auth username |
|---------------|---------------------|
| `/token/session/>whoAmI` | **`0`** |
| `/customer`, `/product`, `/vatType`, … | **companyId** |

---

## Test-gap

Eksisterende tester assertet path og response-shape, ikke Authorization-header.
Ny test pinner `0:session_abc` vs `93310337:session_abc`.

---

## Smoke — klar for retry

Etter staging deploy: verify auth-steg skal passere whoAmI (forutsatt gyldig sandbox-token).

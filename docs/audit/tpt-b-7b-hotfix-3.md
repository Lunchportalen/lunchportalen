# TPT-B-7b-hotfix-3 — Korrekt Tripletex whoAmI-path

**Dato:** 2026-05-21  
**Forrige:** hotfix-2 (`14b9da64`) — parameter-auth uten singleton env

---

## Rotårsak

Smoke-test: verify nådde Tripletex sandbox, men whoAmI returnerte
**404 "Object not found"** på `/v2/whoAmI`.

Tripletex API bruker **action-paths** med `>` prefix (som `:create`):
`GET /token/session/>whoAmI` — dokumentert i
[Tripletex FAQ](https://developer.tripletex.no/docs/documentation/faq/general/)
og [auth-docs](https://developer.tripletex.no/docs/documentation/authentication-and-tokens/).

---

## FASE 2 — Curl-verifisering (lokal sandbox)

| Path | Status | Notat |
|------|--------|-------|
| `/v2/whoAmI` | 401 lokalt | Smoke: **404** med gyldig staging-session |
| `/v2/token/session/>whoAmI` | 401 lokalt | URL encodes til `%3EwhoAmI` |
| `/v2/token/session/%3EwhoAmI` | 401 lokalt | Samme encoded path |

Lokal `.env.local` employee-token ga 401 på alle paths (token/company mismatch).
**Session-create (`/token/session/:create`) returnerte 200** — bekrefter nettverk + consumer flow.

Smoke-404 på top-level `/whoAmI` + Tripletex docs → fix til action-path.

---

## FASE 3 — Audit andre paths

| Path | Status |
|------|--------|
| `/token/session/:create` | OK (session create fungerer) |
| `/customer` | OK (standard resource) |
| `/product` | OK |
| `/vatType` | OK |
| `/order` | OK |
| **`/whoAmI`** | **FEIL → fikset til `/token/session/>whoAmI`** |

Kun whoAmI hadde feil syntax. Ingen andre `>`-paths manglet.

---

## Endring

```ts
const TRIPLETEX_WHO_AM_I_PATH = "/token/session/>whoAmI";
// buildUrl encodes > → %3EwhoAmI (korrekt for fetch)
```

---

## Tester (+1)

`tests/integrations/tripletex/whoAmI.path.test.ts` — assert request-URL inneholder
`/token/session/%3EwhoAmI`, ikke top-level `/v2/whoAmI`.

**Test-gap:** Eksisterende tester mocket response uten å asserte URL-path
(samme mønster som hotfix-1 og hotfix-2).

---

## Smoke — klar for retry

Etter staging deploy: Test 1 verify skal passere whoAmI-steg (forutsatt gyldig sandbox-token).

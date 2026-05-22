# TPT-B-7b-hotfix-7 — /ledger/vatType + decimal rate-match

**Dato:** 2026-05-22  
**Forrige:** hotfix-6 (`1d68426b`) — outbox UUID-claim + grants

---

## Rotårsak

Smoke avdekket to bugs i `ensureProviderVatCode`-stien:

1. **Path namespace:** `GET /vatType` → 404 «Object not found». Korrekt path er `/ledger/vatType` (ledger namespace). Samme bug-klasse som hotfix-3 (`whoAmI` action-path).
2. **Rate-format:** `billing_tax_codes.rate` er decimal (`0.25`, `0.15`, `0.00`), men onboarding lookup brukte `[25, 15, 0]` → ingen matches → VAT-steg silently skipped / feilet.

---

## FASE 1 — Path audit

| Path | Namespace | Status |
|------|-----------|--------|
| `/token/session/:create` | token | OK |
| `/token/session/>whoAmI` | token action | OK (hotfix-3) |
| `/customer` | top-level | OK |
| `/product` | top-level | OK |
| `/order` | top-level | OK |
| `/vatType` | — | **FEIL** → `/ledger/vatType` |
| `/account`, `/voucher`, `/posting` | — | Ikke brukt i kodebase |

---

## Fix

1. **`TRIPLETEX_VAT_TYPE_PATH = "/ledger/vatType"`** i `client.ts`
2. **`normalizeVatRateForComparison()`** — DB decimal (0.25) vs Tripletex percent (25)
3. **`REQUIRED_VAT_RATES = [0.25, 0.15, 0]`** i `onboardingSync.ts`

---

## Verifikasjon

- `tests/integrations/tripletex/vatType.path.test.ts` — assert URL-shape
- `tests/integrations/onboarding.taxRate.test.ts` — decimal DB lookup + 3× ensureProviderVatCode

---

## Referanser

- [Tripletex developer docs](https://developer.tripletex.no/docs) — vatType under ledger
- PHP/Ruby/Go SDKs bruker `/ledger/vatType`

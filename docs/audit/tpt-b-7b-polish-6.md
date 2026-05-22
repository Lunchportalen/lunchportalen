# TPT-B-7b-polish-6 — Tripletex Customer DTO + nested-id audit

**Dato:** 2026-05-22  
**Forrige:** polish-5 (`02ef806b`) — companies schema + error-mapping  
**Verify:** E2E customer-sync etter fix (se nederst)

---

## Tripletex DTO-pattern (referanse)

Tripletex API 2 entity-referanser i POST/PUT-body er **nested `{ id: number }`**, ikke flat streng eller `*Id`-felt.

| Feil | Korrekt |
|------|---------|
| `unit: "stk"` | `productUnit: { id: 2237422 }` |
| `vatTypeId: 11` | `vatType: { id: 11 }` |
| `postalAddress.country: "NO"` | `postalAddress.country: { id: 161 }` |

**Country lookup:** `GET /v2/country?from=0&count=300` → match `isoAlpha2Code` (ISO 3166-1 alpha-2). Cache 24t per session-key (Tripletex session max 24h).

---

## Fikset i polish-6

| Endpoint | Felt | Fix |
|----------|------|-----|
| `POST /customer` | `postalAddress.country` | `resolveTripletexCountryId()` + `buildTripletexCustomerCreateBody()` |
| `POST /product` | `productUnit`, `vatType` | Allerede fikset hotfix-9 |

**Kode-stier oppdatert:** `ensureCustomer`, `ensureProviderCustomer`, `ensureCompanyCustomer` (`client.ts`).

---

## DTO-audit — alle Lp Tripletex POST/PUT

| Call | Felt | Status | Notat |
|------|------|--------|-------|
| `POST /customer` | `postalAddress.country` | **Fikset polish-6** | Var flat `"NO"` |
| `POST /product` | `productUnit`, `vatType` | **OK** (hotfix-9) | Nested `{ id }` |
| `POST /product` | `account` | **OK** | `maybeAccount()` → `{ id }` |
| `POST /order` | `customer` | **OK** | `{ id: customerId }` |
| `POST /order` | `orderLines[].product` | **OK** | `{ id: productId }` |
| `POST /order` | `orderLines[].vatType` | **OK** | `{ id: vatTypeId }` |
| `POST /order` | `orderLines[].account` | **OK** | `{ id }` via `maybeAccount` |
| `POST /order` | `currency` | **Trolig OK** | ISO-streng `"NOK"` per OrderDTO — ikke entity-ref |
| `PUT /order/:id/:invoice` | (ingen body) | **OK** | Query `sendToCustomer` only |
| `PUT` credential rotation | — | **N/A** | Ikke Tripletex entity DTO |

### Flagget for polish-7+ (ikke blokkert nå)

| Område | Risiko | Når |
|--------|--------|-----|
| `tripletex_customers` upsert via PostgREST `onConflict` på partial unique index | **Fikset polish-6** | `persistCompanyProviderCustomerMapping()` insert/update |
| `POST /order` `currency` som `{ id }` | Lav — fungerer som ISO-streng i smoke | Verifiser ved første invoice-create-feil |
| `paymentTerm`, `department`, `project` på order | Ikke brukt i Lp | Ved utvidelse av order-payload |
| `POST /supplier` | Ikke implementert | Fremtidig |
| Backlog: 25× `companyCustomerCreateProvider` FAILED_PERMANENT | Data/scope — egen patch | Ikke polish-6 |

---

## Verify (2026-05-22 E2E)

| Sjekk | Resultat |
|-------|----------|
| outbox `SENT` | ✓ |
| `customers_ensured: 1`, `customers_skipped: 0` | ✓ |
| `tripletex_customers` row for FX Co A | ✓ (staging) |
| Partial-index upsert fix | Required for mapping persist |


Customer-sync: Tripletex 409 + orgnr-lookup (`findTripletexCustomerIdByOrgnr`) før re-create. Mapping i `tripletex_customers` forhindrer duplikat POST.

---

## Tester

- `tests/integrations/tripletex/customer.payload.test.ts`
- `tests/integrations/tripletex/countryResolve.test.ts`

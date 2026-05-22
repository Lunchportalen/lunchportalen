# TPT-B-7b-polish-6 — Tripletex Customer DTO + nested-id audit

**Dato:** 2026-05-22  
**Forrige:** polish-5 (`02ef806b`) — companies schema + error-mapping  
**Oppdatert:** polish-8 (`96dcc9fd+`) — fullfører currency/paymentTerm/department/project audit  
**Verify:** E2E customer-sync etter fix (se nederst)

---

## Tripletex DTO-pattern (referanse)

Tripletex API 2 entity-referanser i POST/PUT-body er **nested `{ id: number }`**, ikke flat streng eller `*Id`-felt.

| Feil | Korrekt |
|------|---------|
| `unit: "stk"` | `productUnit: { id: 2237422 }` |
| `vatTypeId: 11` | `vatType: { id: 11 }` |
| `postalAddress.country: "NO"` | `postalAddress.country: { id: 161 }` |
| `currency: "NOK"` | `currency: { id: 1 }` |

**Country lookup:** `GET /v2/country?from=0&count=300` → match `isoAlpha2Code` (ISO 3166-1 alpha-2). Cache 24t per session-key (Tripletex session max 24h).

**Currency lookup:** `GET /v2/currency?from=0&count=300` → match `code` (ISO 4217, f.eks. `NOK`). Samme 24t cache-mønster som country.

---

## Fikset i polish-6

| Endpoint | Felt | Fix |
|----------|------|-----|
| `POST /customer` | `postalAddress.country` | `resolveTripletexCountryId()` + `buildTripletexCustomerCreateBody()` |
| `POST /product` | `productUnit`, `vatType` | Allerede fikset hotfix-9 |

**Kode-stier oppdatert:** `ensureCustomer`, `ensureProviderCustomer`, `ensureCompanyCustomer` (`client.ts`).

---

## Fikset i polish-8

| Endpoint | Felt | Fix |
|----------|------|-----|
| `POST /order` | `currency` | `resolveTripletexCurrencyId()` + `buildTripletexOrderCreateBody()` i `createInvoice()` |

**Kilde:** Tripletex OrderDTO (`currency: Currency` i SDK) + GitHub tripletex-api2 issue #21 (orderlines med `currency: { id }`).

---

## DTO-audit — alle Lp Tripletex POST/PUT (polish-8 komplett)

| Call | Felt | I bruk | Format før | Status polish-8 | Handling |
|------|------|--------|------------|-----------------|----------|
| `POST /customer` | `postalAddress.country` | Ja | flat `"NO"` | **Fikset polish-6** | `resolveTripletexCountryId` |
| `POST /product` | `productUnit`, `vatType` | Ja | — | **Verifisert OK** (hotfix-9) | Nested `{ id }` |
| `POST /product` | `account` | Ja | — | **Verifisert OK** | `maybeAccount()` → `{ id }` |
| `POST /order` | `customer` | Ja | — | **Verifisert OK** | `{ id: customerId }` |
| `POST /order` | `currency` | Ja | flat `"NOK"` | **Fikset polish-8** | `resolveTripletexCurrencyId` |
| `POST /order` | `orderLines[].product` | Ja | — | **Verifisert OK** | `{ id: productId }` |
| `POST /order` | `orderLines[].vatType` | Ja | — | **Verifisert OK** | `{ id: vatTypeId }` |
| `POST /order` | `orderLines[].account` | Ja | — | **Verifisert OK** | `{ id }` via `maybeAccount` |
| `POST /order` | `paymentTerm` | **Nei** | — | **Ikke i bruk** | Ved fremtidig bruk: nested `{ id }` |
| `POST /order` | `department` | **Nei** | — | **Ikke i bruk** | Ved fremtidig bruk: nested `{ id }` |
| `POST /order` | `project` | **Nei** | — | **Ikke i bruk** | Ved fremtidig bruk: nested `{ id }` |
| `PUT /order/:id/:invoice` | (ingen body) | Ja | — | **Verifisert OK** | Query `sendToCustomer` only |
| `PUT` credential rotation | — | N/A | — | **N/A** | Ikke Tripletex entity DTO |

### Payload-byggere (Lp sender Tripletex-body)

| Fil | Linje | DTO | Felt | Merknad |
|-----|-------|-----|------|---------|
| `client.ts` | `buildTripletexCustomerCreateBody` | Customer | `postalAddress.country` | polish-6 |
| `client.ts` | `buildTripletexProductCreateBody` | Product | `productUnit`, `vatType` | hotfix-9 |
| `client.ts` | `buildTripletexOrderCreateBody` | Order | `currency`, `customer`, `orderLines` | polish-8 |
| `agreementInvoiceSync.ts` | ~330 | (via `createInvoice`) | `currency: "NOK"` | Lp input ISO → resolver i `createInvoice` |
| `providerSaasInvoiceSync.ts` | ~273 | (via `createInvoice`) | `currency: "NOK"` | Samme |

---

## Gjenstående (utenfor polish-8 scope)

| Område | Risiko | Når |
|--------|--------|-----|
| `tripletex_customers` upsert via PostgREST | **Fikset polish-6** | `persistCompanyProviderCustomerMapping()` |
| Backlog: 25× `companyCustomerCreateProvider` FAILED_PERMANENT | Data/scope — egen patch | Ikke polish-8 |
| `POST /supplier` | Ikke implementert | Fremtidig — bruk nested `{ id }` |

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
- `tests/integrations/tripletex/currencyResolve.test.ts` (polish-8)
- `tests/integrations/tripletex/order.payload.test.ts` (polish-8)
- `tests/integrations/tripletex/product.payload.test.ts`

---

## Regresjonsregel (polish-8+)

Fjerde patch i samme bug-klasse. **Før ny Tripletex POST/PUT:** sjekk Swagger/SDK for entity-ref-felter. Flat streng/tall på referanse-felt → STOPP og bruk `{ id }` + resolver med 24t cache.

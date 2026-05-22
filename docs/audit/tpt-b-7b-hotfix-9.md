# TPT-B-7b-hotfix-9 — POST /product DTO mapping

**Dato:** 2026-05-22  
**Forrige:** hotfix-8 (`eefffe18`) — service_role GRANTs

---

## Rotårsak

Tripletex `POST /product` returnerte 422 «Request mapping failed»:

```json
{
  "validationMessages": [
    { "field": "unit", "message": "Feltet eksisterer ikke i objektet." }
  ]
}
```

Lp sendte flat `unit: "stk"`. Tripletex ProductDTO krever `productUnit: { id: <unitId> }` fra `GET /product/unit`.

---

## FASE 1 — Faktisk payload + respons

**Sendt (feil):**
```json
{
  "name": "Firmalunsj BASIS",
  "number": "LP-742c7d6c-BASIS",
  "unit": "stk",
  "isStockItem": false,
  "vatType": { "id": 11 }
}
```

**Tripletex validation:** `unit` finnes ikke på DTO.

**Korrekt (verifisert live mot api-test):**
```json
{
  "productUnit": { "id": 2237422 },
  "vatType": { "id": 11 }
}
```

---

## Fix

- `resolveTripletexProductUnitId()` — mapper `billing_products.unit` (f.eks. `stk`) → Tripletex unit id via `GET /product/unit`
- `buildTripletexProductCreateBody()` — delt ProductDTO-builder
- `extractMessage()` — inkluderer `validationMessages` i feiltekst (observability)

---

## Pattern-lærdom

Tripletex DTO ID-references er **nested `{ id: X }`**, ikke flat `<field>Id` eller string labels:

| Feil | Korrekt |
|------|---------|
| `unit: "stk"` | `productUnit: { id: 2237422 }` |
| `vatTypeId: 11` | `vatType: { id: 11 }` |

**Audit andre POST/PUT (flagg for senere):**
- `/customer` — sjekk nested refs ved neste smoke-feil
- `/order` — orderLine nested objects

---

## Verifikasjon

`tests/integrations/tripletex/product.payload.test.ts` — assert request-body shape.

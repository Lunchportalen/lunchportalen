# TPT-B-2 — Provider Company-Customer + Product/VAT Sync (Flow B)

**Patch:** TPT-B-2  
**Status:** ✅ COMPLETED  
**Dato:** 2026-05-21  
**Migrasjon:** `20260529120000_tpt_b2_flow_b_mapping.sql`  
**Applied:** staging (`uigxsboqeruxflgzqztl`) + prod (`hkpokyapzarefrgqzkos`) via MCP  

---

## 1. Mål

Onboarde companies som Tripletex-kunder i **provider's egen Tripletex-konto** (Flow B), og etablere per-provider product/VAT-mapping for måltidsfakturering — forutsetning for TPT-B-3 (agreement invoice generation).

---

## 2. Schema-valg: **Alternativ A** (utvid `tripletex_customers`)

| Aspekt | Valg |
|--------|------|
| Mapping-tabell | Gjenbruk `tripletex_customers` — **ikke** ny `provider_company_tripletex_customers` |
| CHECK constraint | Relaxed: `company_id IS NOT NULL OR provider_id IS NOT NULL` |
| Flow A Lp→company | `company_id` satt, `provider_id` NULL — partial unique index `tripletex_customers_company_lp_only` |
| Flow A Lp→provider | `provider_id` satt, `company_id` NULL — partial unique index `tripletex_customers_provider_lp_only` |
| **Flow B** | **Begge** satt — partial unique index `tripletex_customers_provider_company (provider_id, company_id)` |
| Product mapping | Ny tabell `provider_tripletex_products` (tier × provider × env) |

### Begrunnelse

- Eksisterende infrastruktur og audit-mønster fra TPT-A-3
- Én sannhetskilde for Tripletex customer-ID per scope
- Partial unique indexes erstatter globale UNIQUE på `company_id`/`provider_id` alene

---

## 3. Idempotency-design

| Lag | Mekanisme |
|-----|-----------|
| Outbox enqueue | `ON CONFLICT (event_key) DO NOTHING` — event_key `tripletex.company_customer_create_provider:<company_id>:<provider_id>` |
| Handler pre-check | SELECT mapping `(company_id, provider_id)` → return SENT hvis finnes |
| Tripletex API | **409 Conflict = success** — parse existing customer id fra conflict body eller orgnr lookup |
| Product sync | SELECT `provider_tripletex_products` før POST `/product` |
| Re-prosessering | Samme mapping returneres; audit kun ved ny opprettelse |

---

## 4. Authorization-matrise

### RPC `lp_company_provider_customer_create`

| Rolle | Tillatelse |
|-------|------------|
| superadmin | ✅ alle provider/company-par |
| provider_admin | ✅ kun egen `provider_id` (via `lp_assert_provider_admin_or_superadmin`) |
| company_admin | ❌ |
| employee / anon | ❌ |

**Validering:**

- Company må finnes
- `companies.provider_id` må matche `p_provider_id`
- `env` ∈ `{test, prod}`

### Outbox worker

- Kjører som `service_role` via `/api/system/outbox/process`
- Auth til Tripletex: `resolveTripletexAuth({ providerId, env })` — provider's Vault-credentials (TPT-B-1)

### `provider_tripletex_products` RLS

| Rolle | Tillatelse |
|-------|------------|
| superadmin | ALL |
| provider_admin | SELECT egen provider |
| service_role | ALL (worker upsert) |

---

## 5. Outbox + worker

**Event key:** `tripletex.company_customer_create_provider:<company_id>:<provider_id>`

**Payload:**

```json
{
  "company_id": "<uuid>",
  "provider_id": "<uuid>",
  "env": "prod",
  "request_rid": "<rid>"
}
```

**Handler:** `handleCompanyCustomerCreateProvider` i `lib/integrations/tripletex/companyCustomerSync.ts`

**Flyt:**

1. Parse payload / event_key
2. Sjekk eksisterende mapping
3. Hent company billing-profil fra DB
4. `ensureCompanyCustomer({ admin, company, providerId, env })` — auth resolves internt
5. Audit `company_provider_customer_created` **før** outbox SENT
6. Mark outbox SENT

**Feilklassifisering:**

| Feil | Outbox-status |
|------|---------------|
| 409 Tripletex | SENT (success) |
| 5xx / nettverk | PENDING (retry) |
| Manglende creds / validering | FAILED (permanent) |
| Company ikke funnet | FAILED |

---

## 6. Product + VAT sync (library — ikke auto-triggered)

Funksjoner klare for TPT-B-3/B-5:

| Funksjon | Beskrivelse |
|----------|-------------|
| `ensureProviderVatCode({ providerId, taxCodeId, env })` | GET `/vatType`, match `billing_tax_codes.rate` |
| `ensureProviderProduct({ providerId, tier, env })` | BASIS/LUXUS/ENTERPRISE per provider; lagrer i `provider_tripletex_products` |

**Product-strategi:** Én Tripletex-product per tier per provider (fra `billing_products`), ikke per meny-element.

**VAT-strategi:** Match lokal `billing_tax_codes.rate` mot Tripletex VAT-liste; fallback til `tripletex_vat_code`-kolonne.

Auto-sync ved credentials-add er **TPT-B-7** — ikke i denne patchen.

---

## 7. Tester

`tests/integrations/companyCustomerCreateProvider.test.ts` (7 cases):

1. Happy path → mapping created
2. Idempotency → existing mapping
3. Tripletex 409 → success
4. Provider creds not configured → FAILED
5. Tripletex 500 → PENDING (retry)
6. Missing company → FAILED
7. Export guard for `ensureProviderProduct` / `ensureProviderVatCode`

`tests/db/lp_provider_create.test.ts` — Flow B scope (both IDs allowed).

**Preflight:** 2376/2376 PASS.

---

## 8. Manuell oppgave

Seed test-provider Tripletex credentials på staging hvis ikke gjort (TPT-B-1):

```sql
SELECT public.lp_provider_set_tripletex_credentials(
  '<provider_uuid>', 'test', '<consumer>', '<employee>', <company_id>
);
```

---

## 9. Neste steg

**TPT-B-3:** Agreement invoice generation — bruker customer mapping + `ensureProviderProduct` for fakturalinjer.

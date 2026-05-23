# PR-X4 DC-026 Tripletex Flow 1 flag — Discovery (2026-05-23)

## Flow 1 vs Flow 2 skille

| Aspekt | Flow 1 (Lp → kunder SaaS) | Flow 2 (per-provider tokens) |
|--------|---------------------------|------------------------------|
| Auth | `resolveTripletexAuth()` uten `providerId` → `loadLpCredentials()` | `resolveTripletexAuth({ providerId, env })` → `loadProviderCredentials()` |
| Env | `TRIPLETEX_COMPANY_ID` + `TRIPLETEX_TOKEN` eller `TRIPLETEX_CONSUMER_TOKEN` + `TRIPLETEX_EMPLOYEE_TOKEN` | Vault RPC `lp_provider_load_tripletex_credentials` |
| Domene | Lp fakturerer kunder/leverandører via Lp sin Tripletex-konto | Hver leverandør sin Tripletex-konto; Lp pusher avtalefakturaer |

**Implicit default lokasjon:** `lib/integrations/tripletex/client.ts:323-353` (`loadConfig()`) og `:463-472` (`loadLpCredentials()`). Kalles når `resolveTripletexAuth()` kjøres uten `providerId`.

Branching er tydelig i `resolveTripletexAuth()` (providerId ? provider : lp).

## Entry points

| Fil | Type | Flow | Notat |
|-----|------|------|-------|
| `app/api/cron/tripletex-saas-monthly/route.ts` | CRON | Flow 1 | Full route-gate |
| `app/api/system/outbox/process/route.ts` | CRON | Mixed | Flow 1 batches: invoice.ready, provider_customer_create_lp, saas_invoice_create_lp |
| `app/api/cron/tripletex-outbox/route.ts` | CRON | Mixed | Delegerer til outbox/process |
| `app/api/tripletex/prod-verify/route.ts` | API | Flow 1 | Superadmin LP auth probe |
| `lib/integrations/tripletex/client.ts` | LIB | Flow 1 | `resolveTripletexAuth()` LP-path |
| `lib/integrations/tripletex/providerSaasInvoiceSync.ts` | LIB | Flow 1 | `handleSaasInvoiceCreateLp` |
| `lib/integrations/tripletex/providerCustomerSync.ts` | LIB | Flow 1 | `handleProviderCustomerCreateLp` |

**Flow 1 entry points: 7** (cron 2 route + 1 mixed worker, api 1, lib 3)

## Flow 2 — bekreftet upåvirket

| Fil | Type | Notat |
|-----|------|-------|
| `app/api/cron/tripletex-connection-health-daily/route.ts` | CRON | Per-provider whoAmI |
| `app/api/cron/tripletex-agreements-daily/route.ts` | CRON | Agreement billing |
| `app/api/webhooks/tripletex/route.ts` | WEBHOOK | Provider webhooks |
| `lib/integrations/tripletex/agreementInvoiceSync.ts` | LIB | `resolveTripletexAuth({ providerId })` |
| `lib/integrations/tripletex/companyCustomerSync.ts` | LIB | Provider-scoped |
| `lib/integrations/tripletex/onboardingSync.ts` | LIB | Provider onboarding |
| `lib/integrations/tripletex/providerProductSync.ts` | LIB | Provider product sync |
| `lib/integrations/tripletex/onboardingVerify.ts` | LIB | Provider token verify (parameter auth) |

Outbox Flow 2 event kinds (fortsetter når flag=false): `tripletex.company_customer_create_provider`, `tripletex.agreement_invoice_create_provider`, `tripletex.provider_product_sync`, `tripletex.onboarding_provisioning_start`.

## Feature-flag pattern

Eksisterende `lib/core/featureFlags.ts` bruker opt-out (`ENABLE_*`, unset = enabled). DC-026 krever fail-closed opt-in → ny fil `lib/server/config/featureFlags.ts`.

## Eksisterende tester berørt

| Testfil | Endring |
|---------|---------|
| `tests/integrations/tripletexClientAuth.test.ts` | `TRIPLETEX_FLOW_1_ENABLED='true'` i beforeEach |
| `tests/integrations/providerSaasInvoiceCreateLp.test.ts` | idem |
| `tests/integrations/providerCustomerCreateLp.test.ts` | idem |
| `tests/api/cron/tripletexSaasMonthly.test.ts` | flag=true for RPC-tester; ny skip-test |

Flow 2-tester (f.eks. `loadProviderCredentials.test.ts`, `tripletex-connection-health-daily`) krever ikke flag.

## STOPP-vurdering

- Entry points ≤ 10: **PASS (7)**
- Tydelig Flow 1/2 branching: **PASS**
- Implicit default i client.ts som forventet: **PASS**

→ Fortsetter til implement.

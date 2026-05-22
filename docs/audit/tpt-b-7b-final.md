# TPT-B-7b — Final session audit (smoke pass 2026-05-22)

**Patch:** TPT-B-7b — Direct wizard UI + smoke hardening  
**Session:** 2026-05-21 → 2026-05-22  
**Environment:** Staging (`uigxsboqeruxflgzqztl`) → Tripletex sandbox (`api-test.tripletex.tech`)  
**Provider (smoke):** `742c7d6c-3632-4362-a665-da0e415aab8c`  
**Status:** ✅ Smoke pass — wizard end-to-end → **CONNECTED** on staging  
**Artefakt-type:** Permanent referanse for B-7c og første prod-onboarding

---

## 1. Executive summary

### Hva ble testet

- **Direct wizard** (`/leverandor/innstillinger/tripletex/koble-til`) happy-path mot Tripletex **test-API**
- Steg: Employee Token verify → connection complete → outbox provisioning → webhook secret → CONNECTED
- Worker/cron-stier: outbox claim, VAT/product/customer provisioning, Vault credentials, webhook mottak

### Hva ble bevist

| Bevis | Resultat |
|-------|----------|
| Verify (session-create + whoAmI + scope) | ✅ 200 på api-test |
| Vault lagring (consumer + employee) | ✅ Identisk fingerprint som verify-input |
| Outbox provisioning worker | ✅ Event `SENT`, `onboarding_provisioning_complete_at` satt |
| Tripletex produkter (BASIS/LUXUS/ENTERPRISE) | ✅ 3 produkter opprettet i provider-konto |
| Webhook subscription (manuell API-registrering) | ✅ 3 ACTIVE subscriptions på api-test |
| Wizard UI end-to-end | ✅ **CONNECTED** på staging |

### Bug-tally

| Kategori | Antall | Merknad |
|----------|--------|---------|
| **Hotfixes (kode/DB)** | **9** | 27fa35e6 → abb078be |
| **Dormant prod-bug** | **1** | Outbox UUID-claim (hotfix-6) — aktiv på prod med uuid `outbox.id` |
| **Staging-only data** | **1** | `COMPANY_NOT_FOUND` — agreement peker på manglende company-rad |
| **UI-bugs (uferdig)** | **2** | Fake progress + feil webhook-hjelp-tekst |
| **Arkitektur/ops-gaps** | **3** | BASE_URL vs env, staging cron, GRANT-drift pattern |

---

## 2. Hotfix-register

### Hotfix 1 — RPC guard-order

| Felt | Verdi |
|------|-------|
| **Commit** | `27fa35e6` |
| **Filer** | `supabase/migrations/20260604120000_tpt_b7_hotfix_guard_order.sql`, `tests/db/lp_provider_complete_tripletex_connection.serviceRole.test.ts`, `tests/db/lp_provider_test_tripletex_token.serviceRole.test.ts` |
| **Rotårsak** | B-7 RPCs sjekket `auth.uid()` før `service_role`-elevated caller → verify/complete feilet fra worker. |
| **Fix** | Reordered guards: `lp_is_elevated_caller()` / platform-admin først. |
| **Prod-impact** | Ja — alle service_role onboarding-RPC-kall var blokkert uten fix. |
| **Test-pattern** | DB RPC integration med `service_role` client. |

---

### Hotfix 2 — Parameter-auth (loadConfig)

| Felt | Verdi |
|------|-------|
| **Commit** | `14b9da64` |
| **Filer** | `lib/integrations/tripletex/client.ts`, `tests/integrations/tripletex/requestTripletex.parameterAuth.test.ts`, `tests/integrations/tripletex/verifyTripletexEmployeeToken.parameterAuth.test.ts` |
| **Rotårsak** | `requestTripletex` ignorerte `options.auth` og brukte alltid singleton env-config. |
| **Fix** | Respekter parameter-auth; env-config kun som fallback. |
| **Prod-impact** | Ja — verify med in-memory tokens kunne treffe feil credentials. |
| **Test-pattern** | Assert auth-header dekoder til `{companyId}:{token}` fra parameter, ikke env. |

---

### Hotfix 3 — whoAmI path

| Felt | Verdi |
|------|-------|
| **Commit** | `84679af2` |
| **Filer** | `lib/integrations/tripletex/client.ts`, `tests/integrations/tripletex/whoAmI.path.test.ts`, `tests/integrations/tripletex/verifyTripletexEmployeeToken.parameterAuth.test.ts` |
| **Rotårsak** | `GET /whoAmI` returnerer 404; korrekt action-path er `/token/session/>whoAmI`. |
| **Fix** | `TRIPLETEX_WHO_AM_I_PATH = "/token/session/>whoAmI"`. |
| **Prod-impact** | Ja — verify step 2 feilet for alle providers. |
| **Test-pattern** | **URL-shape**: assert URL inneholder `%3EwhoAmI`, ikke `/v2/whoAmI`. |

---

### Hotfix 4 — whoAmI Basic auth username

| Felt | Verdi |
|------|-------|
| **Commit** | `e21057a7` |
| **Filer** | `lib/integrations/tripletex/client.ts`, `tests/integrations/tripletex/whoAmI.path.test.ts` |
| **Rotårsak** | whoAmI krevde Basic auth username `"0"`, ikke `companyId`. |
| **Fix** | `tripletexWhoAmI` bruker `{ companyId: "0", token }` for whoAmI-kall. |
| **Prod-impact** | Ja — verify feilet etter path-fix. |
| **Test-pattern** | **Auth-header**: assert decoded Basic = `0:session_token`, ikke `{companyId}:token`. |

---

### Hotfix 5 — Verify audit observability

| Felt | Verdi |
|------|-------|
| **Commit** | `4a125df9` |
| **Filer** | `lib/integrations/tripletex/onboardingVerify.ts`, `lib/integrations/tripletex/client.ts`, `supabase/migrations/20260605120000_tpt_b7_hotfix5_verify_audit_diag.sql`, `tests/integrations/tripletex/verifyTripletexEmployeeToken.auditMetadata.test.ts`, `docs/audit/tpt-b-7b-hotfix-5.md` |
| **Rotårsak** | Verify-feil ga lite sporbarhet i audit (`step_failed`, HTTP-status per steg). |
| **Fix** | `audit_diag` per verify-forsøk merges inn i RPC audit metadata. |
| **Prod-impact** | Nei (observability) — kritisk for smoke/debug. |
| **Test-pattern** | Assert audit payload shape (`steps.session_create.http_status`, `hotfix_version`). |

---

### Hotfix 6 — Outbox UUID-claim + grants ⚠️ DORMANT PROD-BUG

| Felt | Verdi |
|------|-------|
| **Commit** | `1d68426b` |
| **Filer** | `lib/outbox/claimIds.ts`, `app/api/system/outbox/process/route.ts`, outbox row types (6 sync-filer), `supabase/migrations/20260606120000_tpt_b7_hotfix6_outbox_grants.sql`, `tests/outbox/claim.uuid.test.ts`, `docs/audit/tpt-b-7b-hotfix-6.md` |
| **Rotårsak** | `Number(row.id)` på uuid → `NaN` → **0 events claimet** silently; staging manglet `GRANT` på `billing_tax_codes` / `tripletex_customers`. |
| **Fix** | `extractOutboxClaimIds()` (uuid string + legacy bigint); defensive GRANT migration. |
| **Prod-impact** | **Ja — KRITISK.** Prod `outbox.id` = uuid (6 rader). Første CONNECTED provider ville aldri fått provisioning uten fix. |
| **Test-pattern** | Assert uuid-string claimes; legacy `Number(uuid)` → `[]`. |

**Verifisert:** Prod `pg_typeof(outbox.id)` = `uuid`, 6 rader.

---

### Hotfix 7 — `/ledger/vatType` + decimal rates

| Felt | Verdi |
|------|-------|
| **Commit** | `a320b59a` |
| **Filer** | `lib/integrations/tripletex/client.ts`, `lib/integrations/tripletex/onboardingSync.ts`, `tests/integrations/tripletex/vatType.path.test.ts`, `tests/integrations/onboarding.taxRate.test.ts`, `tests/integrations/loadProviderCredentials.test.ts`, `docs/audit/tpt-b-7b-hotfix-7.md` |
| **Rotårsak** | `GET /vatType` → 404; rate lookup `.in("rate", [25,15,0])` vs DB decimal `0.25/0.15/0`. |
| **Fix** | `TRIPLETEX_VAT_TYPE_PATH = "/ledger/vatType"`; `REQUIRED_VAT_RATES = [0.25, 0.15, 0]`; `normalizeVatRateForComparison()`. |
| **Prod-impact** | Ja — VAT provisioning feilet for alle providers uten fix. |
| **Test-pattern** | **URL-shape** + **DB lookup match** (decimal rates). |

---

### Hotfix 8 — service_role GRANTs

| Felt | Verdi |
|------|-------|
| **Commit** | `eefffe18` |
| **Filer** | `supabase/migrations/20260607120000_tpt_b7_hotfix8_service_role_grants.sql`, `docs/audit/tpt-b-7b-hotfix-8.md` |
| **Rotårsak** | Staging schema-drift: `billing_products` og `lifecycle_audit_log` manglet GRANT til `service_role`. |
| **Fix** | Idempotent GRANT migration (SELECT på `billing_products`; SELECT+INSERT på `lifecycle_audit_log`). |
| **Prod-impact** | Staging-only drift; prod hadde grants (no-op). Pattern gjelder alle env. |
| **Test-pattern** | `has_table_privilege('service_role', …)` staging vs prod (manuell/MCP). |

---

### Hotfix 9 — POST `/product` productUnit DTO

| Felt | Verdi |
|------|-------|
| **Commit** | `abb078be` |
| **Filer** | `lib/integrations/tripletex/client.ts`, `tests/integrations/tripletex/product.payload.test.ts`, `docs/audit/tpt-b-7b-hotfix-9.md` |
| **Rotårsak** | Flat `unit: "stk"` finnes ikke på ProductDTO → 422 «Request mapping failed». |
| **Fix** | `productUnit: { id }` via `GET /product/unit`; `buildTripletexProductCreateBody()` + `resolveTripletexProductUnitId()`. |
| **Prod-impact** | Ja — produktopprettelse feilet for alle providers. |
| **Test-pattern** | **Request-body shape**: `productUnit: {id}`, ikke `unit` eller `vatTypeId`. |

---

## 3. Side-findings (tagged for fremtidig patch)

| Tag | Finding |
|-----|---------|
| **[BUG]** | `Step2Provisioning.tsx` hardkoder MVA ✓ + Produkter ✓ — ikke ekte worker-progress |
| **[BUG]** | Wizard-tekst peker på Tripletex «Innstillinger → Webhook-integrasjoner» — finnes ikke i Tripletex UI |
| **[BUG]** | Customer-sync skipped: `COMPANY_NOT_FOUND` (`90634f78-…` agreement vs manglende `companies`-rad på staging) |
| **[ARCH]** | `credentials.env` styrer Vault-oppslag, men `TRIPLETEX_BASE_URL` er global env — lokal dispatch uten BASE_URL traff prod-host med test-tokens |
| **[UX]** | «STEG 1–2 AV 5» forvirrende (indre vs ytre steg-telling) |
| **[UX]** | Cascade «Feilet» på verify-items 2/3 når item 1 feiler (selv om ikke kjørt) |
| **[OPS]** | Vercel Cron binder til production — staging krever manuell dispatch eller GitHub Action |
| **[OPS]** | `billing_tax_codes` seed mangler 25%/15% i enkelte miljøer (kun rate 0 observert tidlig i sesjon) |
| **[OPS]** | Wizard mangler `validationMessages`-capture fra Tripletex for support/debug |
| **[CI]** | GRANT-coverage-test (staging vs prod `has_table_privilege`) anbefales som CI-step |

### Sesjon-ops (ikke hotfix-commit)

- Webhook-registrering via `POST /event/subscription` på api-test (subscriptions 23070–23072, ACTIVE)
- Manuell outbox-dispatch med `TRIPLETEX_BASE_URL=https://api-test.tripletex.tech/v2` i `.env.local`

---

## 4. Tripletex API patterns (permanent lærdom)

| Pattern | Regel |
|---------|-------|
| **ID-references** | ALLTID `{ id: X }` — aldri flat `xId` eller string label (`unit: "stk"`) |
| **Action-endpoints** | `>` prefix: `/token/session/>whoAmI` (ikke top-level `/whoAmI`) |
| **Ledger namespace** | VAT: `/ledger/vatType` (ikke `/vatType`) |
| **Auth username** | `"0"` for whoAmI; `companyId` (fra credentials) for resource-endpoints |
| **Webhook subscription** | `POST /v2/event/subscription` med `targetUrl`, `authHeaderName`, `authHeaderValue` — **ikke** `subscribeUrl` / `authValue` / `POST /event` |
| **Product units** | Resolve via `GET /product/unit` → `productUnit: { id }` |
| **Session create** | Consumer + employee må matche samme api-host (test vs prod) |

---

## 5. Test-pattern lærdom (B-7c+)

1. **Assert URL-shape** (path), ikke kun response-shape  
2. **Assert Basic auth-header** dekoder til riktig `{user}:{token}`  
3. **Assert request-body shape** (`vatType: {id}`, `productUnit: {id}`)  
4. **Mock på fetch-nivå**, ikke client-singleton  
5. **Test mot både `service_role` og authenticated client** der RPC/RLS er relevant  
6. **Inkluder `validationMessages`** i feil-assertions der Tripletex returnerer 422  

Etablerte testfiler som mønster:

- `tests/integrations/tripletex/whoAmI.path.test.ts`
- `tests/integrations/tripletex/vatType.path.test.ts`
- `tests/integrations/tripletex/product.payload.test.ts`
- `tests/outbox/claim.uuid.test.ts`

---

## 6. Hva som er bevist på prod

| Område | Status |
|--------|--------|
| Migrasjoner hotfix 1–9 | ✅ Applied staging + prod |
| GRANTs (hotfix 6, 8) | ✅ Verifisert; prod no-op der allerede granted |
| Kode (main `abb078be`) | ✅ Pushet; staging deploy Ready |
| Prod providers CONNECTED | ❌ Ingen ennå — smoke var staging-only |
| Dormant UUID-bug | ✅ Fikset før første prod-provider |

### Anbefaling før prod-onboarding

1. **B-7c** dashboard + health — fullfør før første ekte provider  
2. Kjør **GRANT-coverage** staging vs prod i CI  
3. Sett **`TRIPLETEX_BASE_URL`** deterministisk per deploy-target (hotfix-10 kandidat)  
4. Seed **`billing_tax_codes`** 25%/15% der mangler  
5. Aktiver **cron** eller dokumenter manuell dispatch for non-prod  

---

## 7. References

| Dokument | Innhold |
|----------|---------|
| [Tripletex developer docs](https://developer.tripletex.no) | Auth, webhooks, OpenAPI |
| `docs/audit/tpt-b-7b.md` | Wizard UI audit |
| `docs/audit/tpt-b-7-foundation.md` | Schema + RPCs + worker |
| `docs/architecture/tripletex-onboarding-strategy.md` | Arkitektur § 4.1, 5.3, 8 |
| `docs/audit/tpt-b-7b-hotfix.md` … `hotfix-9.md` | Per-hotfix detaljer |
| `docs/audit/tripletex-plan-v1.md` | Plan v3.15+ |

### Commit-tidslinje (fixes only)

```
27fa35e6 → 14b9da64 → 84679af2 → e21057a7 → 4a125df9 → 1d68426b → a320b59a → eefffe18 → abb078be
```

---

*Ingen tokens eller webhook-secrets i dette dokumentet. Generert 2026-05-22.*

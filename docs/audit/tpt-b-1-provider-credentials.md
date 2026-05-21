# TPT-B-1 — Provider Tripletex Credentials (Vault-backed)

**Patch:** TPT-B-1  
**Status:** ✅ COMPLETED  
**Dato:** 2026-05-21  
**Migrasjon:** `20260528120000_tpt_b1_provider_credentials.sql`  
**Applied:** staging (`uigxsboqeruxflgzqztl`) + prod (`hkpokyapzarefrgqzkos`) via MCP  

---

## 1. Mål

Erstatte TPT-A-1-stubben `loadProviderCredentials()` med sikker lagring og oppslag av provider-spesifikke Tripletex-credentials (consumer + employee token), slik at Flow B kan kalle `resolveTripletexAuth({ providerId, env })`.

---

## 2. Encryption-design

### Strategi valgt: **Supabase Vault** (`supabase_vault` v0.3.1)

| Aspekt | Valg |
|--------|------|
| At-rest | Tokens lagres via `vault.create_secret()` / `vault.update_secret()` — aldri plaintext i `provider_tripletex_credentials` |
| Metadata-tabell | Kun UUID-referanser (`consumer_token_secret_id`, `employee_token_secret_id`) + `env`, `company_id_external`, `sync_status` |
| Dekryptering | Kun via SECURITY DEFINER RPC `lp_provider_load_tripletex_credentials` (service_role EXECUTE) |
| Platform-nøkkel | Vault håndterer krypteringsnøkkel internt (Supabase-managed); **Tripletex-tokens lagres aldri i app-env** |
| Rotasjon (hook) | Kolonne `rotation_due timestamptz` + fremtidig patch kan sette dato ved credential-set |

### Alternativ vurdert (ikke valgt)

Application-layer AES-256-GCM med `TRIPLETEX_CREDENTIALS_ENCRYPTION_KEY` i env — avvist til fordel for planens Vault-mønster og eksisterende `supabase_vault`-tilgjengelighet på staging/prod.

### Hardening backlog

- REVOKE `SELECT` på `vault.decrypted_secrets` fra `service_role` (krever verifisering av andre avhengigheter)
- Audit på hvem som kaller load-RPC (utvidet metadata)

---

## 3. Datamodell

```sql
provider_tripletex_credentials (
  id, provider_id UNIQUE, env CHECK (test|prod),
  consumer_token_secret_id, employee_token_secret_id,
  company_id_external, sync_status, encryption_version,
  created_at, updated_at, last_used_at, rotation_due
)
```

Vault cleanup-trigger sletter tilhørende `vault.secrets` ved DELETE på credentials-rad.

---

## 4. RPC-kontrakter

### `lp_provider_set_tripletex_credentials`

- **Guards:** superadmin ELLER `provider_admin` for samme `provider_id`
- **Input:** `p_provider_id`, `p_env`, `p_consumer_token`, `p_employee_token`, `p_company_id_external?`
- **Output:** `{ ok, provider_id, env, is_configured, company_id_external, sync_status }` — **aldri tokens**
- **Audit:** `lifecycle_audit_log` — `action=tripletex_credentials_set`, `entity_type=tripletex_credentials`

### `lp_provider_get_tripletex_credentials_status`

- **Guards:** superadmin ELLER `provider_admin` (egen provider)
- **Output:** `{ is_configured, env, last_used_at, company_id_external, sync_status, rotation_due? }` — **aldri tokens**

### `lp_provider_load_tripletex_credentials`

- **Guards:** `service_role` EXECUTE only (ikke authenticated)
- **Output:** `{ provider_id, env, company_id_external, consumer_token, employee_token }`
- **Sideeffekter:** oppdaterer `last_used_at`; audit `tripletex_credentials_loaded`

---

## 5. RLS-matrise

| Rolle | `provider_tripletex_credentials` | Status-RPC | Set-RPC | Load-RPC |
|-------|----------------------------------|------------|---------|----------|
| superadmin | ALL (via policy) | ✅ | ✅ | via service_role |
| provider_admin | ❌ ingen direkte SELECT | ✅ egen provider | ✅ egen provider | ❌ |
| service_role | ALL (bypass RLS) | — | — | ✅ (audited) |
| anon / employee | ❌ | ❌ | ❌ | ❌ |

---

## 6. App-lag (`client.ts`)

`loadProviderCredentials(providerId, env)`:

1. Kaller `lp_provider_load_tripletex_credentials` via `supabaseAdmin()`
2. Oppretter Tripletex session-token via `createSessionTokenFromPair()`
3. Returnerer `{ companyId, token }` (TripletexAuth)
4. Feil: `PROVIDER_CREDENTIALS_NOT_CONFIGURED`, `PROVIDER_CREDENTIALS_ENV_MISMATCH`, `PROVIDER_CREDENTIALS_DISABLED`

Provider-path krever **ikke** `TRIPLETEX_COMPANY_ID` i env — company ID kommer fra `company_id_external` i credentials-rad.

---

## 7. Hvordan provider_admin setter creds (UI)

**TPT-B-7** (ikke i scope): UI på `/leverandor/tripletex`.

Inntil da: kall `lp_provider_set_tripletex_credentials` via superadmin RPC eller direkte PostgREST med provider_admin JWT.

---

## 8. Tester

`tests/integrations/loadProviderCredentials.test.ts`:

- Happy path (set → resolveTripletexAuth → session)
- Not configured
- Vault encryption roundtrip (secret ≠ plaintext)
- Audit log per load
- RLS (provider_admin: status ja, load nei, direkte SELECT nei)

`tests/integrations/tripletexClientAuth.test.ts` oppdatert (mock + `PROVIDER_CREDENTIALS_NOT_CONFIGURED`).

---

## 9. Manuell oppgave

Seed eksempel-credentials for staging-test hvis Tripletex test-konto finnes:

```sql
-- Via superadmin JWT eller SQL som postgres etter provider finnes:
SELECT public.lp_provider_set_tripletex_credentials(
  '<provider_uuid>', 'test', '<consumer>', '<employee>', <company_id>
);
```

Verifiser med `lp_provider_get_tripletex_credentials_status`.

---

## 10. Neste steg

**TPT-B-2 ✅ COMPLETED** — se `docs/audit/tpt-b-2-company-customer-sync.md`.  
**TPT-B-3:** Agreement invoice generation.

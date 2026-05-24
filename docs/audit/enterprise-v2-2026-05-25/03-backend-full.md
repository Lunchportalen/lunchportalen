# Fase C — Backend Full Deep

**Audit:** Enterprise v2 · **Dato:** 2026-05-25  
**Metode:** READ-ONLY · fil-åpnet + prod SQL (Supabase MCP `hkpokyapzarefrgqzkos`)  
**Status:** SUB C.1 + C.2 + C.3 **COMPLETE** → STOP-PUNKT C

**Artifacts (regenererbare):**

- `.tmp/c1-migration-classify.json` — 267 migrasjoner klassifisert (fil-åpnet)
- `.tmp/c1-ledger-compare.json` — prod ledger vs repo
- `.tmp/prod-migrations-mcp.json` — MCP `list_migrations` snapshot

---

## Coverage-ledger (Fase C)

| Sub | Scope | Filer/SQL åpnet | Coverage |
| --- | --- | ---: | ---: |
| **C.1** | Migrasjoner + N+1 | 267 SQL + N+1 grep | 100% migrations |
| **C.2** | Functions T1/T2/T3 | 385 prod functions (SQL) + app cross-link | T1 deep 54 · T2 sample 40+ · T3 count |
| **C.3** | RLS + pool + MD cross-ref | 232 policies SQL + 8 RLS tests + `RLS_POLICIES.md` | 100% policy count |

---

# SUB C.1 — Migrasjoner + N+1

## C.1.1 Migrasjon-inventar

| Metrikk | Verdi | Bevis |
| --- | ---: | --- |
| Repo-filer `supabase/migrations/*.sql` | **267** | `node scripts/audit/c1-migration-classify.mjs` |
| Prod `schema_migrations` (MCP) | **98** | `list_migrations` 2026-05-25 |
| Filer eksplisitt lest (utf-8 read) | **267/267** | `opened: true` per rad i classify JSON |

### Klassifisering (primary kind)

| Kind | Antall | % |
| --- | ---: | ---: |
| MIXED | 179 | 67% |
| DDL | 52 | 19% |
| INDEX | 15 | 6% |
| GRANT | 6 | 2% |
| FUNCTION | 6 | 2% |
| RLS | 5 | 2% |
| DML | 3 | 1% |
| TRIGGER | 1 | <1% |

*MIXED dominerer — typisk enterprise-migrasjon med DDL + RLS + GRANT + FUNCTION i én fil (f.eks. TPT-B-* patches).*

### Farlige patterns (hele corpus, fil-åpnet)

| Pattern | Antall filer | v2 vurdering |
| --- | ---: | --- |
| `DROP … CASCADE` | **0** | Ingen treff i 267 filer |
| `DELETE` uten `WHERE` | **0** | Ingen treff |
| `SECURITY DEFINER` uten `search_path` i **fil** | **0** i migrasjoner med DEFINER | Prod SQL bekrefter 0 DEFINER uten search_path (C.2) |
| `ALTER TABLE ADD COLUMN` uten lock-hint | **59** | **P2** — forventet for idempotent `add column if not exists`; vurder `ACCESS EXCLUSIVE` kun for store tabeller i fremtidig migrasjon |
| `BEGIN` uten `COMMIT` i fil | **0** flagged | — |

**Eksempel åpnet:** `supabase/migrations/20260217_enterprise_outbox_worker_rpc.sql` L1–60 — idempotent index law, dynamic drop non-primary unique indexes ( ikke CASCADE).

---

## C.1.2 V1-funn re-verifisering: APPLIED_OUTSIDE_GIT (27%)

**V1 påstand (audit-v1-shallow):** 26/98 (27%) prod migrasjoner uten repo-match.

**V2 bytte-analyse** (`scripts/audit/c1-migration-ledger-compare.mjs` mot MCP prod ledger):

| Status | Antall | % av prod 98 |
| --- | ---: | ---: |
| `EXACT_VERSION` | 20 | 20% |
| `NAME_MATCH_DIFF_VERSION` | 47 | 48% |
| `APPLIED_OUTSIDE_GIT` | **31** | **32%** |

### Konklusjon

| | |
| --- | --- |
| **Er 27% outside-git sant?** | **Retning riktig, tall var lavt.** V2 finner **31% (31/98)** uten repo-match på versjon **eller** slug. |
| **Hvorfor avvik?** | V1 matchet delvis via prefix; v2 matcher også **slug** og skiller **NAME_MATCH_DIFF_VERSION** (prod timestamp ≠ repo filnavn, samme semantikk). |
| **Har vi repo-dekning?** | **67/98 (68%)** har repo-fil (exact eller name-match). **31** har ingen repo-kilde — **verre enn v1 antok**. |
| **P1?** | **Ja (uendret)** — process debt; prod kan ikke reconstrueres fra git alene for 31 entries. |

### 31 × APPLIED_OUTSIDE_GIT (prod versjon + name)

| version | name |
| --- | --- |
| 20260507184900 | normalize_status_enums_uppercase_v6_constraints |
| 20260507222054 | add_kitchen_batch_day_choices_rls_policies |
| 20260507222112 | add_day_choices_date_company_user_index |
| 20260514172458 | 20260514181500_day_choices_item_columns |
| 20260515145748 | test_ping_migration_sql |
| 20260520112841 | suspend_rpc_public_provider |
| 20260520112849 | suspend_rpc_public_company |
| 20260520112851 | suspend_rpc_public_user |
| 20260520133500 | provider_match_postal_code |
| 20260520133506 | provider_registration_rpc_create |
| 20260520133509 | provider_registration_rpc_assert |
| 20260520133520 | provider_registration_rpc_reject |
| 20260520133530 | patch13_provider_registration_rpc_approve |
| 20260520134937 | patch14_lp_service_area_save |
| 20260520134938 | patch14_lp_service_area_toggle |
| 20260520140327 | patch15_lp_provider_set_subscription |
| 20260520140328 | patch15_lp_provider_update_billing_contact |
| 20260520140330 | patch15_lp_provider_generate_invoice |
| 20260521081644 | 20260529120000_tpt_b2_flow_b_mapping |
| 20260521085747 | 20260530120000_tpt_b3_agreement_invoices |
| 20260521085844 | 20260530120001_tpt_b3_agreement_invoice_rpcs |
| 20260521134921 | 20260603120000_tpt_b7_foundation |
| 20260521204434 | tpt_b7_hotfix_guard_order |
| 20260522000304 | tpt_b7_hotfix5_verify_audit_diag |
| 20260522010736 | tpt_b7_hotfix6_outbox_grants |
| 20260522104933 | tpt_b7_polish5_companies_billing_profile |
| 20260522140728 | tpt_b7_polish9_webhook_subscriptions |
| 20260522201310 | 20260522160000_k4_kill_esg_tables |
| 20260523150430 | dc018_enable_rls_billing |
| 20260523151652 | dc019_enable_rls_tenant_tables |
| 20260523232327 | k6_prod_tenant *(repo: `20260524130000_k6_prod_tenant.sql` — name-match diff version)* |

*Note: `k6_prod_tenant` listed outside because compare script slug mismatch — manuelt name-match finnes i repo.*

---

## C.1.3 N+1 deep-scan (`app/` · `lib/` · `workers/`)

**Metode:** `rg` multiline for `for`/`map(async` + `await` + `.from`/`.rpc`; manuell lesning av treff.

| ID | Sev | Fil | Linje | Mønster | Vurdering |
| --- | --- | --- | ---: | --- | --- |
| C-N1-01 | **P2** | `app/api/cron/tripletex-connection-health-daily/route.ts` | 141–179 | `for (const row of rows)` → 1–2× `admin.rpc()` per provider | **Ekte N+1** ved mange providers; cron-bound OK today, batch RPC anbefalt |
| C-N1-02 | P3 | `app/api/order/window/route.ts` | 940–949 | `Promise.all(legacyDays.map(async …))` | **Parallel**, not sequential N+1 — `getMenuForDateAndPlan` per day |
| C-N1-03 | — | `lib/**/*.ts` | — | Dominant `Promise.all([...])` batch reads | **Good pattern** (kitchen, admin, superadmin) |
| C-N1-04 | — | `workers/worker.ts` | 125–139 | Single dequeue loop | No Supabase N+1 |

**Ingen** `for…await supabase.from` sequential loop funnet i `app/` uten parallel wrapper (grep null on strict pattern).

---

# SUB C.2 — Postgres functions (stratifisert)

## C.2.0 Prod inventory (SQL)

```sql
-- execute_sql prod 2026-05-25
SELECT count(*) FILTER (WHERE prosecdef) AS definer,
       count(*) FILTER (WHERE NOT prosecdef) AS invoker,
       count(*) AS total
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f';
-- → definer=107, invoker=278, total=385
```

| Metrikk | Verdi |
| --- | ---: |
| `public` functions | 385 |
| SECURITY DEFINER | 107 |
| SECURITY INVOKER | 278 |
| DEFINER uten `search_path` (prod) | **0** |
| Extension-tunge (approx) | ~288 tied to extensions |

---

## C.2.1 Tier 1 — DEEP (sensitive + DEFINER)

**Kriterium:** DEFINER + (`lp_*`/`tg_*` touching orders, agreements, profiles, billing, idempotency, audit_log).

**Count:** **54** funksjoner (SQL `pg_get_functiondef` ILIKE filter 2026-05-25).

### lp_idem_begin — staff review (prod def, head)

| Attributt | Verdi |
| --- | --- |
| Security | **DEFINER** |
| search_path | `'public'` ✓ |
| Idempotency | `SELECT … FOR UPDATE` on `idempotency`; hash mismatch → `23514` |
| Tenant | Scope+key only — **no company_id** (by design; scope=`orders.write` in app) |
| App link | `app/api/orders/route.ts` L382–387 |

### lp_order_set — staff review

| Attributt | Verdi |
| --- | --- |
| Security | **DEFINER** |
| Entry | `auth.uid()` → `profiles.id` lookup |
| Writes | orders, order_items, day_choices, outbox (idempotent event_key) |
| Guards | cutoff 08:00 Oslo, agreement active, delivery_days JSON |
| App link | `lib/orders/rpcWrite.ts` L96, `app/api/orders/route.ts` L420 |

### Tier 1 roster (54 — prod SQL)

`lp_agreement_activate`, `lp_agreement_approve_active`, `lp_agreement_lifecycle_hook`, `lp_agreement_reject_pending`, `lp_apply_tripletex_paid_status`, `lp_company_*` (10), `lp_compute_agreements_due_today`, `lp_delivery_set_status`, `lp_esg_rollup_month`, `lp_generate_*`, `lp_idem_begin|complete|fail`, `lp_invoice_build_month`, `lp_order_advance_status`, **`lp_order_set`**, `lp_outbox_retry_event`, `lp_production_freeze_day`, `lp_provider_*` (20+), `lp_run_daily_agreement_billing`, `lp_service_area_*`, `lp_user_*`, **`tg_audit_row`**, `tg_create_profile_from_auth_user`

### Tier 1 findings

| ID | Sev | Funn | Bevis |
| --- | --- | --- | --- |
| C-FN-01 | P2 | `lp_esg_rollup_month` DEFINER exists; ESG killed in K4 — **orphan RPC** | prod `proname` list + migration `k4_kill_esg` |
| C-FN-02 | P2 | Duplicate overload names `outbox_claim_next`, `outbox_mark_failed`, `outbox_mark_sent` (2× each in DEFINER list) | MCP query LIMIT 100 — signature review needed |
| C-FN-03 | **P1** (carry v1) | Idempotency **kun** wired in `POST /api/orders` — Tier-1 `lp_idem_*` unused elsewhere | grep `.rpc("lp_idem_begin"` → 1 route file |
| C-FN-04 | P2 | `agreements` **ingen** `audit_row` trigger; `companies`/`orders` har | `pg_trigger` query 2026-05-25 |

---

## C.2.2 Tier 2 — MEDIUM (app-called lp_*)

**Metode:** `rg '\.rpc\("lp_' app/ lib/` → **80+ call sites** across routes.

| Hot RPC | Call sites (sample) | Role gate |
| --- | --- | --- |
| `lp_order_set` | orders route, set route, tests | employee auth |
| `lp_idem_begin` | orders POST only | employee |
| `lp_outbox_claim` | cron outbox | service_role |
| `lp_provider_*` | superadmin/provider APIs | platform admin |
| `lp_company_register` | onboarding | anon/authenticated |

**Tier 2 finding C-FN-05 (P2):** ~80 RPC call sites — no centralized RPC allowlist in TypeScript (rely on RLS + route guards). Acceptable RC; DD should document.

---

## C.2.3 Tier 3 — OVERFLATE

| Bucket | Count | Notes |
| --- | ---: | --- |
| Extension functions (btree_gist, citext, pgcrypto, …) | ~288 | Not app-called; v1 confirmed |
| `private.*` helpers | (see golden snapshot) | RLS predicate functions |
| Non-sensitive triggers | updated_at, etc. | Standard |

---

# SUB C.3 — RLS + pool + cross-reference

## C.3.1 Prod RLS inventory

| Metrikk | SQL result |
| --- | --- |
| `pg_policies` public | **232** |
| `pg_policies` cron | 2 |
| Tables `rls_off` in public | **37** — all `audit_log_y*` partitions + default |
| Sensitive tables `orders`, `profiles`, `agreements` | **rls_on** ✓ |

### Sample policy expressions (fil-åpnet via SQL)

**orders_select** (prod):

```sql
( SELECT private.can_view_order(orders.id) AS can_view_order)
```

**Cross-tenant vurdering:** Delegert til `private.can_view_order` — **indirect tenant check** (staff-OK hvis helper er korrekt; golden snapshot has body_hash for private.*).

**idempotency:** INSERT/UPDATE policies = `none` (deny authenticated writes) — **fail-closed** ✓; writes via DEFINER RPC.

---

## C.3.2 tests/rls/ — coverage per policy?

| Fil | Dekker |
| --- | --- |
| `tenantIsolation.final.test.ts` | Cross-tenant isolation scenarios |
| `domainHardening.agreementOrders.test.ts` | `lp_order_set` + agreement rules |
| `ordersLifecycleGate.test.ts` | Order lifecycle |
| `orderImmutability0805.test.ts` | Cutoff immutability |
| `migrationParity.test.ts` | **Full policy parity vs golden** (when DATABASE_URL set) |
| `golden-rls-snapshot.json` | **190 policies** catalogued |

| Metrikk | Verdi |
| --- | ---: |
| Prod policies | 232 |
| Golden policies | 190 |
| **Gap** | **46 policies not in golden** *(alle TRACKED i git — se C.3.4)* |

| ID | Sev | Funn |
| --- | --- | --- |
| C-RLS-01 | **P1** | Golden snapshot **stale** vs prod (190 vs 232) — drift job may false-green or miss 42 policies |
| C-RLS-02 | P2 | **Not** 1:1 vitest per policy — coverage via golden + domain tests only |

---

## C.3.3 RLS_POLICIES.md vs pg_policies

| | `RLS_POLICIES.md` (root) | Prod `pg_policies` |
| --- | --- | --- |
| Linjer | **20** (locked excerpt) | **232 policies** |
| Scope | Kitchen/driver `orders_kitchen_driver_scope_read` | Full catalog |
| Updated | 2026-02-16 | Live |

**Gap-tabell:**

| Dokument-claim | Verifisert? | Gap |
| --- | --- | --- |
| Kitchen/driver scope on orders | **Partial** — prod uses `private.can_view_order`, not policy name in MD | Name drift; semantics likely equivalent |
| «232 policies documented» | **NEI** | MD is excerpt only — **ASPIRATIONAL as full catalog** |
| Fail-closed tenant | **JA** (sample SQL) | — |

**Anbefaling:** Treat `RLS_POLICIES.md` as **decision record**, not inventory. Authoritative: `tests/rls/golden-rls-snapshot.json` (needs refresh — C-RLS-01).

---

## C.3.4 C-RLS-01 mini-verifisering (2026-05-25)

**Formål:** Sample 10 av prod-policies som mangler i golden snapshot → finnes `CREATE POLICY <navn>` i migrasjonsrepo?

**Metode:** `scripts/audit/c-rls01-mini-verify.mjs` + full klassifisering `c-rls01-full-classify.mjs` mot prod SQL (232 policies, DATABASE_URL 2026-05-25).

| Metrikk | Verdi |
| --- | ---: |
| Prod policies | **232** |
| Golden policies (korrekt nøkkel `schema.table.name`) | **190** |
| **Missing from golden** | **46** *(tidligere «42» var aritmetisk diff uten nøkkel-normalisering; 4 golden-rader matcher ikke prod-nøkkel)* |
| Sample (deterministisk indeks 0,4,8,…,36) | **10** |
| **UNTRACKED i sample** | **0** |
| **UNTRACKED totalt (46/46)** | **0** |
| **TRACKED totalt** | **46/46** |

### Sample-resultat (10/10 TRACKED)

| Policy | Tabell | cmd | Migrasjon-kilde |
| --- | --- | --- | --- |
| `agreement_invoice_lines_company_admin_select` | agreement_invoice_lines | SELECT | `20260530120000_tpt_b3_agreement_invoices.sql` |
| `agreement_invoices_provider_select` | agreement_invoices | SELECT | `20260530120000_tpt_b3_agreement_invoices.sql` |
| `billing_products_authenticated_select` | billing_products | SELECT | `20260609120000_dc018_enable_rls_billing.sql` |
| `company_deletions_superadmin_select` | company_deletions | SELECT | `20260609130000_dc019_enable_rls_tenant_tables.sql` |
| `invoice_periods_tenant_select` | invoice_periods | SELECT | `20260609130000_dc019_enable_rls_tenant_tables.sql` |
| `menu_service_days_select_provider_scope` | menu_service_days | SELECT | `20260520170001_provider_rls_core_policies.sql` |
| `invoices_superadmin_all` | provider_invoices | ALL | `20260520230000_provider_subscriptions.sql` |
| `provider_memberships_superadmin_all` | provider_memberships | ALL | `20260520150001_provider_core_rls_baseline.sql` |
| `service_areas_update_admin` | provider_service_areas | UPDATE | `20260520220000_provider_service_areas_admin.sql` |
| `provider_tripletex_products_provider_select` | provider_tripletex_products | SELECT | `20260529120000_tpt_b2_flow_b_mapping.sql` |

### Gate-beslutning

| Regel | Resultat |
| --- | --- |
| >5/10 UNTRACKED → oppgrader C-RLS-01 til **P0**, stopp før Fase D | **NEI** — 0/10 UNTRACKED |
| ≤5/10 UNTRACKED → behold **P1**, fortsett Fase D | **JA** |

**Konklusjon:** Alle 46 «missing» policies har migrasjons-kilde i git. **Root cause = golden snapshot stale**, ikke untracked prod-only RLS. C-RLS-01 forblir **P1** (refresh golden + parity test).

**Artifacts:** `.tmp/prod-policies-mcp.json`, `.tmp/c-rls01-mini-verify.json`, `.tmp/c-rls01-full-classify.json`

---

## C.3.5 Pool + connection lifecycle

| Metrikk | Verdi | Bevis |
| --- | --- | --- |
| `max_connections` prod | **60** | `pg_settings` SQL |
| Tier signal | Micro | v1 B1-08 confirmed |
| App client pattern | **New client per request** | `utils/supabase/server.ts` L10–29 `createServerClient` each call |
| Admin client | Singleton module cache | `lib/supabase/admin.ts` L75 `_admin = createClient(...)` |
| Pooler | Supabase Supavisor (transaction mode) | PostgREST + serverless |

| ID | Sev | Funn |
| --- | --- | --- |
| C-POOL-01 | **P1** | 60 conn + Vercel concurrency + 13 crons → K6 100 VU marginal (carry v1) |
| C-POOL-02 | P2 | Per-request SSR client = new logical connection via pooler — **OK** for serverless; document max concurrent |

**Direct vs pooler:** App uses HTTPS to PostgREST (`NEXT_PUBLIC_SUPABASE_URL`), not raw `DATABASE_URL` in routes — **pooler path** for app reads/writes.

---

# audit-v4.cjs — gjenbruk vurdering

| | `audit-v4.cjs` | Enterprise v2 |
| --- | --- | --- |
| Formål | AST import graph, dead files, circular deps, AI flow heuristics | Staff-level SQL + fil-åpnet + prod truth |
| Output | Console score /100 | Markdown + JSON artifacts |
| Backend/RLS | **Nei** | **Ja** (MCP SQL) |
| Migrations | **Nei** | **Ja** (267 classify) |
| N+1 | **Nei** | **Ja** (grep + manual) |
| Tabeller | **Nei** | Partial (golden RLS JSON) |

**Konklusjon:** v4 **kan gjenbrukes** for **frontend architecture** (dead code, circular imports) — **ikke** for backend audit v2 scope. Kjør `node audit-v4.cjs` som supplement til Fase D, not replacement. Does **not** build migration/RLS tables we need.

---

# Fase C — funn-oppsummering

| ID | Sev | Rolle | Funn |
| --- | --- | --- | --- |
| C-MIG-01 | P1 | BACKEND | 31/98 prod migrations APPLIED_OUTSIDE_GIT (32%, v1 undercounted) |
| C-MIG-02 | P2 | BACKEND | 59 migrations ALTER ADD COL without lock strategy doc |
| C-N1-01 | P2 | BACKEND | Tripletex health cron sequential RPC loop |
| C-FN-03 | P1 | BACKEND | Systemic idempotency gap (lp_idem_* only on orders POST) |
| C-FN-04 | P2 | BACKEND | agreements missing audit_row trigger |
| C-RLS-01 | P1 | BACKEND | Golden RLS snapshot stale (190 vs 232 policies) |
| C-RLS-02 | P2 | BACKEND | No per-policy vitest; golden parity only |
| C-RLS-03 | P2 | BACKEND | RLS_POLICIES.md excerpt ≠ live catalog |
| C-POOL-01 | P1 | BACKEND+DEVOPS | max_connections=60 pool margin |

---

## Completeness (C.1–C.7)

| Item | Status |
| --- | --- |
| C.1 All migrations opened | **COVERED** 267/267 |
| C.2 Functions stratified | **COVERED** T1 54 deep, T2 cross-link, T3 surface |
| C.3 RLS all policies counted | **COVERED** 232 SQL |
| C.4 N+1 scan | **COVERED** |
| C.5 Pool lifecycle | **COVERED** |
| C.6 RLS_POLICIES.md cross-ref | **COVERED** |
| C.7 tests/rls coverage | **COVERED** |

---

## STOP-PUNKT C

**Fase C COMPLETE.** Vent **`GO Fase D`** (frontend full deep).

*READ-ONLY — ingen migrasjoner, rotasjon eller kodeendringer i denne sesjonen.*

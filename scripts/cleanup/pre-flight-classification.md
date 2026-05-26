# Pre-flight classification — PF.1 fix-plan

**Generated:** 2026-05-26 (session)  
**Branch:** `main` (local HEAD `2aeb7d9f`, **3 commits ahead** of `origin/main`)  
**Method:** `git status --porcelain` inventory + migration file read + Supabase MCP `schema_migrations` / live data checks  
**Git operations:** **NONE** performed (classification only)

---

## Summary

| Kategori | Beskrivelse | Antall (linjer/grupper) |
|----------|-------------|-------------------------|
| **1** | AUDIT-LEVERANSE → commit til `main` | **~52 paths** (1 modified + 51 untracked) |
| **2** | UNCERTAIN MIGRATIONS → **STOP** | **4** SQL-filer |
| **3** | SPIKE/CLEANUP-SCOPE → la stå (Z.2) | **~95 paths** |
| **4** | ANNET → **STOP** for beslutning | **~28 paths** |

**Deploy-i-vente (ikke PF.1, dokumentert):**

```
2aeb7d9f fix(prod-readpath): remove ghost columns and user_id profile fallback
35d02f64 fix(dc-032): allow employee scope on orders/today GET/POST
ea027081 fix(dc-032): week profile select — drop missing disabled_reason column
```

---

## Category 2 — UNCERTAIN MIGRATIONS (STOP)

**Eskalering:** K6-migrasjoner er **applied i DB med andre versjonstidsstempler enn filnavn i working tree** → konkret **C-MIG-01** (outside-git / timestamp drift).

| Filnavn | Innhold-sammendrag | Prod-status | Staging-status | Anbefaling |
|---------|-------------------|-------------|----------------|------------|
| `supabase/migrations/20260516140000_repair_lp_order_set_and_vat_rate_tolking.sql` | FASE 13: VAT `0.15` desimal-normalisering, `tg_order_item_snapshot`, full `lp_order_set` RPC rewrite (~738 linjer). Header: «kjør mot prod først etter review». | **NOT APPLIED** — `schema_migrations` har ingen `20260516140000`. `lp_order_set` def ~15.8k tegn; `pg_get_functiondef` inneholder **ikke** `vat_rate` (indikerer gammel prod-def). | **NOT APPLIED** — samme versjon absent i `schema_migrations`. | **STOP — eierbeslutning:** (A) Commit til git som **pending** review-migrasjon — **ikke** apply uten godkjenning; eller (B) avvis/arkiver hvis superseded. **Ikke** auto-apply. |
| `supabase/migrations/20260524130000_k6_prod_tenant.sql` | Idempotent K6 prod tenant «Lunchportalen QA» + 20 pool-brukere. Refs `sp-4-k6-prod-prep`, DC-034/035. | **APPLIED UNDER DRIFT** — `schema_migrations`: `20260523232327` / `k6_prod_tenant`. Selskap `Lunchportalen QA` (orgnr `888888888`) + **20** k6-brukere bekreftet live. Filversjon `20260524130000` **finnes ikke** i ledger. | N/A (staging guard i SQL) | **STOP — reconcile:** Commit SQL til git med **filnavn = applied version** `20260523232327_k6_prod_tenant.sql` (rename), eller legg inn tom/no-op migrasjon + dokumenter alias. **Ikke** re-kjør (idempotent skip, men ledger-kollisjon). |
| `supabase/migrations/20260624120000_k6_staging_grants.sql` | GRANTs for K6 order-preflight chain (`closed_dates`, `company_current_agreement*`, `agreement_delivery_days`). | N/A | **APPLIED UNDER DRIFT** — `schema_migrations`: `20260523211956` / `k6_staging_grants`. Filversjon `20260624120000` absent. Grants live (9 rader i `role_table_grants` sample). | **STOP — reconcile:** Rename/commit som `20260523211956_k6_staging_grants.sql` eller ledger repair. **Ikke** re-apply blindt. |
| `supabase/migrations/20260624120100_k6_test_users.sql` | 20 K6 pool employees på Company A (staging guard). Placeholder passwords → `provision-k6-pool.mjs`. | N/A | **APPLIED UNDER DRIFT** — `schema_migrations`: `20260523212342` / `k6_test_users`. **20** `k6-vu-*@lunchportalen.no` bekreftet. Filversjon `20260624120100` absent. | **STOP — reconcile:** Rename/commit som `20260523212342_k6_test_users.sql`. **Ikke** re-apply blindt. |

### MCP query evidence (Category 2)

```sql
-- Prod hkpokyapzarefrgqzkos
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version IN ('20260516140000','20260524130000','20260624120000','20260624120100');
→ []

SELECT version, name FROM supabase_migrations.schema_migrations
WHERE name ILIKE '%k6%' OR version LIKE '20260516%' OR version LIKE '20260524%' OR version LIKE '20260624%';
→ 20260516191414 close_20260204_drift
→ 20260523232327 k6_prod_tenant

SELECT id, name FROM public.companies WHERE name = 'Lunchportalen QA';
→ e0a00000-…-000000000001 / Lunchportalen QA

-- Staging uigxsboqeruxflgzqztl
→ 20260523211956 k6_staging_grants
→ 20260523212342 k6_test_users

SELECT count(*) FROM auth.users WHERE email LIKE 'k6-vu-%@lunchportalen.no';
→ 20
```

---

## Category 4 — ANNET (STOP for beslutning)

| Fil/path | Beskrivelse | Anbefaling |
|----------|-------------|------------|
| `.screenshots/` (5 filer) | Playwright/manual screenshot output (`polish7-status-screenshot.mjs` → `.screenshots/`). Audit v2 `02-monorepo-anatomi.md` sier KEEP gitignored. | **Gitignore** (`.screenshots/`) — **ikke** commit. Z.2 eller egen chore. |
| `scripts/k6/dc028-auth-flow.mjs` | K6 auth flow (DC-028 marathon) | Commit med **SP-4/K6 batch** til `main` (cat 1 utvidelse) **eller** defer til cleanup branch |
| `scripts/k6/dc028-probe.mjs` | K6 probe | Samme |
| `scripts/k6/diag-prod-pool-access.mjs` | Prod pool diagnostic | Samme — **sensitive** (prod paths) |
| `scripts/k6/probe-prod-pool-login.mjs` | Prod login probe | Samme |
| `scripts/k6/provision-k6-pool.mjs` | Staging pool provision | Commit med K6 batch (referenced by migrations) |
| `scripts/k6/provision-k6-prod-pool.mjs` | Prod pool provision | Commit med K6 batch |
| `scripts/k6/verify-pool-logins.mjs` | Pool login verify | Commit med K6 batch |
| `scripts/k6/results/pgss-after-*.txt` | pg_stat_statements capture | **Gitignore** eller `archive/` — runtime evidence, not source |
| `scripts/k6/results/pgss-before-*.txt` | pg_stat_statements capture | **Gitignore** |
| `scripts/smoke/*.mjs` (11 filer) | DC-011 / staging-parity / env-merge smoke scripts | Commit som **feat(audit): smoke scripts** **eller** defer |
| `scripts/sentry-diag-env-check.mjs` | Sentry env diagnostic | Defer / gitignore — kan lese env |
| `scripts/debug-dispatch-outbox.ts` | One-off Tripletex outbox debug | **Ikke commit** — slett i Z.2 eller `archive/spike-2026-05/` |
| `scripts/apply-patch13-rpc.mjs` | Applies `mcp_patch13_rpc_part2.sql` via DATABASE_URL | **Cat 3 spike** (duplikat med root `mcp_patch*`) — slett Z.2 |
| `admin-agreement-page.txt` | Full paste of `app/admin/agreement/page.tsx` | **Slett Z.2** — accidental capture |
| `agreement-status-full.txt` | Debug/status capture | **Slett Z.2** |
| `scripts/audit/staging-schema-dump-2026-05-20.sql` | Full staging schema dump | **STOP:** stor + kan inneholde staging-spesifikke detaljer. Anbefaling: **gitignore** + behold lokalt, **eller** redacted excerpt i audit docs only |
| `scripts/cleanup/pre-flight-classification.md` | Denne filen | Commit med første godkjente batch (meta) |
| `umbraco-clean.zip` / `umbraco-robots-only.zip` | **TRACKED** (~275 MB) — **ikke** i `??` liste | **Utenfor denne PF.1-runden** — håndteres i Z.2 på cleanup branch |
| `.verify-logs/` | — | **Finnes ikke** i working tree |

---

## Full classification table

| Fil/path | Kat | Audit-relasjon | Anbefaling | Sjekk-bevis |
|----------|-----|----------------|------------|-------------|
| `docs/engineering/developer-onboarding-guide.md` | **1** | A-P1-01 / §12 secret-hygiene | Commit: `docs(onboarding): §12 secret-hygiene` | `git diff` → ny §12, lenker til `01-spike-cleanup.md` + `rotate-checklist-2026-05-25.md` |
| `docs/audit/enterprise-v2-2026-05-25/**` (13 filer) | **1** | Audit v2 A–I baseline | Commit: `docs(audit): enterprise-v2 report` | Filer listet via glob; §3 LYVENDE confirmed |
| `docs/audit/dc-032-staging-paritet-K6.md` | **1** | DC-032 / K6 parity | Commit med audit docs batch | Untracked `??` |
| `docs/audit/dc-034-add-internal-test-flag-companies.md` | **1** | DC-034 | Commit med audit docs batch | Untracked |
| `docs/audit/dc-035-profile-notifications-disabled.md` | **1** | DC-035 | Commit med audit docs batch | Untracked |
| `docs/audit/sp-3.5-k6-foundation-retry.md` | **1** | SP-3.5 marathon | Commit med audit docs batch | Untracked |
| `docs/audit/sp-3.6-k6-loginonce-retry.md` | **1** | SP-3.6 | Commit med audit docs batch | Untracked |
| `docs/audit/sp-4-k6-prod-prep.md` | **1** | SP-4 | Commit med audit docs batch | Untracked |
| `docs/audit/sp-4.5-k6-prod-readpath-diagnose.md` | **1** | SP-4.5 | Commit med audit docs batch | Untracked |
| `docs/audit/sp-4.6-k6-prod-readpath-fix.md` | **1** | SP-4.6 / DC-032 read-path | Commit med audit docs batch | Untracked |
| `archive/audit-v1-shallow/**` (6 filer) | **1** | v1 superseded → archive | Commit: `chore(archive): audit-v1 shallow` | README states superseded by v2 |
| `scripts/security/rotate-checklist-2026-05-25.md` | **1** | A-P1-01 rotation plan | Commit: `docs(security): rotation checklist` | Refs `01-spike-cleanup.md` |
| `scripts/audit/b3e-copy-sanity-token.mjs` | **1** | B3e rotation ops | Commit audit scripts batch | Untracked |
| `scripts/audit/b3e-rotate-webhook-and-cleanup-env.mjs` | **1** | B3e | Commit audit scripts batch | Untracked |
| `scripts/audit/b3e-set-webhook-secret.mjs` | **1** | B3e | Commit audit scripts batch | Untracked |
| `scripts/audit/c-rls01-full-classify.mjs` | **1** | C-RLS-01 | Commit audit scripts batch | Untracked |
| `scripts/audit/c-rls01-mini-verify.mjs` | **1** | C-RLS-01 | Commit audit scripts batch | Untracked |
| `scripts/audit/c1-migration-classify.mjs` | **1** | C-MIG-01 | Commit audit scripts batch | Untracked |
| `scripts/audit/c1-migration-ledger-compare.mjs` | **1** | C-MIG-01 | Commit audit scripts batch | Untracked |
| `scripts/audit/d1-frontend-inventory.mjs` | **1** | Fase D | Commit audit scripts batch | Untracked |
| `scripts/audit/d3-ts-perf-scan.mjs` | **1** | D-TS-01 / perf | Commit audit scripts batch | Untracked |
| `scripts/audit/dc-011-route-inventory.mjs` | **1** | DC-011 | Commit audit scripts batch | Untracked |
| `scripts/audit/dc032-diff-migrations.mjs` | **1** | DC-032 | Commit audit scripts batch | Untracked |
| `scripts/audit/e1-git-secrets-scan.mjs` | **1** | E1 secrets | Commit audit scripts batch | Untracked |
| `scripts/audit/f1-unprotected-pages.mjs` | **1** | Fase F skip-auth | Commit audit scripts batch | Untracked |
| `scripts/audit/fetch-prod-policies.mjs` | **1** | C-RLS-01 / Z.5 prep | Commit audit scripts batch | Untracked |
| `scripts/audit/p3m3-classify-final.mjs` | **1** | P3M3 prod checks | Commit audit scripts batch | Untracked |
| `scripts/audit/p3m3-classify-sample.mjs` | **1** | P3M3 | Commit audit scripts batch | Untracked |
| `scripts/audit/p3m3-run-prod-checks.mjs` | **1** | P3M3 | Commit audit scripts batch | Untracked |
| `scripts/audit/p3m3-split-chunks.mjs` | **1** | P3M3 | Commit audit scripts batch | Untracked |
| `scripts/audit/provider-audit-v1.md` | **1** | Provider audit notes | Commit audit scripts batch | Untracked |
| `scripts/audit/staging-schema-dump-2026-05-20.sql` | **4** | Staging evidence | **STOP** — gitignore vs commit (see cat 4) | Large SQL dump |
| `supabase/migrations/20260516140000_*.sql` | **2** | FASE 13 / order RPC | **STOP** — see cat 2 table | MCP: not in ledger |
| `supabase/migrations/20260524130000_k6_prod_tenant.sql` | **2** | SP-4 / C-MIG-01 | **STOP** — rename reconcile | MCP prod applied as `20260523232327` |
| `supabase/migrations/20260624120000_k6_staging_grants.sql` | **2** | DC-032 K6 | **STOP** — rename reconcile | MCP staging `20260523211956` |
| `supabase/migrations/20260624120100_k6_test_users.sql` | **2** | DC-032 K6 | **STOP** — rename reconcile | MCP staging `20260523212342` |
| `.env.k6-staging-verify.tmp` | **3** | A-P1-01 spike | La stå → Z.2 delete post-rotation | `git check-ignore` expected after Z.2 gitignore |
| `.env.local.prod-backup` | **3** | A-P1-01 | Z.2 delete | Listed in rotate-checklist |
| `.env.preview-cron.tmp` | **3** | A-P1-01 | Z.2 delete | Spike pattern |
| `.env.prod-k6.tmp` | **3** | A-P1-01 | Z.2 delete | Spike pattern |
| `.env.sentry-diag-check` | **3** | A-P1-01 | Z.2 delete | Spike pattern |
| `.env.sentry-diag-preview` | **3** | A-P1-01 | Z.2 delete | Spike pattern |
| `.env.sentry-staging-check` | **3** | A-P1-01 | Z.2 delete | Spike pattern |
| `.env.staging-check` | **3** | A-P1-01 | Z.2 delete | Spike pattern |
| `.env.staging-check.tmp` | **3** | A-P1-01 | Z.2 delete | Spike pattern |
| `.env.staging-pull.tmp` | **3** | A-P1-01 | Z.2 delete | Spike pattern |
| `.env.vercel.pull.checkpoint` | **3** | A-P1-01 | Z.2 delete | Spike pattern |
| `.dc028-secret.tmp` | **3** | Secret spike | **Z.2 delete ASAP** (secret material) | Never commit |
| `.smoke-provision.meta.json` | **3** | Smoke spike | Z.2 delete | Spike pattern |
| `.smoke-provision.sql` | **3** | Smoke spike | Z.2 delete | Spike pattern |
| `.commit_msg_*.txt` (**38 filer**) | **3** | Commit drafts | Z.2: grep history → rm or archive | `ls .commit_msg_*.txt` |
| `.p3m3-*` (**28 filer**) | **3** | P3M3 MCP spike | Z.2 rm or archive/spike-2026-05 | Root spike prefix |
| `.tpt_*` / `.tpt_b*` (**10 filer**) | **3** | TPT migration spike | Z.2 rm/archive | Root spike prefix |
| `.mcp_apply_*` / `.migration_*` | **3** | MCP apply spike | Z.2 rm | 3 JSON + 1 SQL |
| `.dc011-inventory.json` | **3** | DC-011 spike | Z.2 rm | Inventory output |
| `apply_payload*.json` (2) | **3** | MCP payload | Z.2 rm | Spike |
| `exec_*.{json,txt}` (4) | **3** | MCP exec spike | Z.2 rm | Spike |
| `invoke_apply_migration.json` | **3** | MCP spike | Z.2 rm | Spike |
| `mcp_apply_*.json` (2) | **3** | MCP spike | Z.2 rm | Spike |
| `mcp_patch13_*` (5 filer) | **3** | Patch13 RPC spike | Z.2 rm/archive | Spike |
| `migration_min.sql` | **3** | Migration spike | Z.2 rm | Spike |
| `diff-stat.txt` | **3** | Diff output | Z.2 rm | Spike |
| `audit-before.json` | **3** | Audit v1 evidence | Z.2 → `archive/audit-v1-shallow/` | Not in archive yet |
| `audit-prod-before.json` | **3** | Audit v1 evidence | Z.2 → archive | Root spike |
| `.audit-full.json` | **3** | Audit v1 evidence | Z.2 → archive | Root spike |
| `.screenshots/**` (5) | **4** | UI evidence | Gitignore — not commit | See cat 4 |
| `scripts/k6/**` (8 scripts + 2 results) | **4** | SP-4 / K6 tooling | User: commit batch or defer | See cat 4 |
| `scripts/smoke/**` (11) | **4** | DC-011 / staging smoke | User: commit or defer | See cat 4 |
| `scripts/sentry-diag-env-check.mjs` | **4** | Sentry diag | Defer / gitignore | See cat 4 |
| `scripts/debug-dispatch-outbox.ts` | **4** | Debug one-off | Z.2 delete | See cat 4 |
| `scripts/apply-patch13-rpc.mjs` | **3** | Patch13 helper | Z.2 delete (pairs w/ mcp_patch*) | Reads `mcp_patch13_rpc_part2.sql` |
| `admin-agreement-page.txt` | **3** | Accidental paste | Z.2 delete | Not source of truth |
| `agreement-status-full.txt` | **3** | Debug capture | Z.2 delete | Spike |

---

## Proposed commit batches (Category 1 only — after user GO)

| # | Commit message (draft) | Paths |
|---|------------------------|-------|
| 1 | `docs(audit): add enterprise-v2 audit report` | `docs/audit/enterprise-v2-2026-05-25/**` |
| 2 | `docs(audit): add marathon K6 and DC audit notes` | `docs/audit/dc-032-*`, `dc-034-*`, `dc-035-*`, `sp-3.*`, `sp-4*` |
| 3 | `feat(audit): add v2 audit automation scripts` | 19× untracked `scripts/audit/*` **excluding** `staging-schema-dump` unless user overrides |
| 4 | `chore(archive): preserve audit-v1 historical baseline` | `archive/audit-v1-shallow/**` |
| 5 | `docs(security): rotation checklist from audit-v2` | `scripts/security/rotate-checklist-2026-05-25.md` |
| 6 | `docs(onboarding): §12 secret-hygiene pattern (per audit)` | `docs/engineering/developer-onboarding-guide.md` |
| 7 | `chore(audit): pre-flight PF.1 classification` | `scripts/cleanup/pre-flight-classification.md` |

**Optional batch 8 (needs cat 4 GO):** `feat(k6): staging/prod pool tooling from SP-4` — `scripts/k6/*.mjs` (not results/)

---

## STOP — awaiting user decisions

1. **`GO COMMIT AUDIT`** — approve category 1 batches (1–7, optionally 8)
2. **Per migration (category 2):** reconcile strategy for 3 K6 files + decision on `20260516140000` repair migration
3. **Per category 4 item:** especially `.screenshots/`, `staging-schema-dump`, `scripts/k6`, `scripts/smoke`

**Do NOT run Z.0** until after D.6–D.7 complete and user sends **`GO Z.0`**.

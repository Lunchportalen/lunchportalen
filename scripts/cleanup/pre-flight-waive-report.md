# Pre-flight WAIVE report — PF.1

**Generated:** 2026-05-26  
**Branch:** `main`  
**After:** GO COMMIT AUDIT (batches 1–9 + migration handling)

---

## PF.1 status: **WAIVED** (with exceptions)

Gjenværende `git status --porcelain` er **overveiende Kategori 3** (spike-filer, Z.2-scope).

### Exceptions (not Category 3)

| Path | Kategori | Reason | Action before Z.0 |
|------|----------|--------|-------------------|
| `supabase/migrations/20260624120100_k6_test_users.sql` | **2 — BLOCKED** | Material content drift vs staging ledger `20260523212342` (expanded local SQL vs minified applied). Norm len 3156 vs 2550. | Owner decision: replace file with ledger SQL + rename, or archive expanded draft |
| `scripts/debug-dispatch-outbox.ts` | **4** | One-off debug | Z.2 delete |
| `scripts/sentry-diag-env-check.mjs` | **4** | Env diagnostic | Z.2 delete or gitignore |
| `scripts/apply-patch13-rpc.mjs` | **3** | Patch13 spike helper | Z.2 delete |

**Gitignored (no longer in porcelain):** `.screenshots/`, `scripts/k6/results/`, `scripts/audit/staging-schema-dump-2026-05-20.sql`

---

## Commits pushed to `main` (PF.1 audit series)

| # | Hash (short) | Message |
|---|--------------|---------|
| 1 | `f225d744` | docs(audit): add enterprise-v2 audit report |
| 2 | `206d4bc4` | docs(audit): add marathon K6 and DC audit notes |
| 3 | `36879306` | feat(audit): add v2 audit automation scripts |
| 4 | `6f62bbca` | chore(archive): preserve audit-v1 historical baseline |
| 5 | `8555b83d` | docs(security): rotation checklist from audit-v2 |
| 6 | `4682fa81` | docs(onboarding): §12 secret-hygiene pattern |
| 7 | `22ae8b88` | chore(audit): pre-flight PF.1 classification and gitignore |
| 8 | `fdfdf2ba` | feat(k6): staging/prod pool tooling from SP-4 |
| 9 | `dd69851f` | feat(smoke): post-deploy verification suite |
| 10 | `e04cefd1` | chore(migrations): defer untested repair migration |
| 11 | `1358efe7` | fix(migrations): reconcile K6 filenames (2/3) |

**Also on branch (pre-existing, deploy-i-vente):** `ea027081`, `35d02f64`, `2aeb7d9f` (DC-032 read-path)

---

## Category 2 — migration outcomes

| File | Result |
|------|--------|
| `20260516140000_repair_lp_order_set…` | → `archive/pending-migrations/` + README |
| `20260524130000_k6_prod_tenant.sql` | ✅ Renamed → `20260523232327_k6_prod_tenant.sql` (content match MCP) |
| `20260624120000_k6_staging_grants.sql` | ✅ Renamed → `20260523211956_k6_staging_grants.sql` (trivial comment diff only) |
| `20260624120100_k6_test_users.sql` | ❌ **STOP** — material drift; not renamed |

### New audit finding (content drift)

**C-MIG-01b:** Local `k6_test_users` draft differs from applied staging ledger (`ON CONFLICT` clauses, guard notice, profile field updates). Git must not claim filename-truth until reconciled.

---

## PF.2–PF.8 (snapshot)

| Assertion | Status |
|-----------|--------|
| PF.2 Branch | `main`; pushed to `origin/main` after audit commits |
| PF.3 Tooling | PASS (Node 22, npm 11, git 2.52, Vercel CLI) |
| PF.4 deps | PASS |
| PF.6 Audit report | PASS (on main) |
| PF.8 Disk | PASS (~169 GB free) |

**PF.1 WAIVED** — spike untracked (~95 paths) are Z.2-scope per classification table.

---

## Proceed?

**`GO Z.0`** to start cleanup branch + baseline (after optional `k6_test_users` decision).

**Do not start Z.2 env-spike delete until Z.1 rotation verified.**

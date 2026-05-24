# Fase A — Spike / Tmp / Secret Hygiene

**Audit:** Enterprise v2 · **Dato:** 2026-05-25  
**Rolle:** DEVOPS (primær) + BACKEND (SQL-spikes)  
**Metode:** READ-ONLY · eksplisitt fil-åpnet per kandidat  
**Coverage:** 95 / 95 kandidat-filer (100%) + 40 `.commit_msg_*.txt` (A.3)

---

## Executive verdict

| | |
| --- | --- |
| **P0 (STOP)** | **Ingen** — ingen live secrets i **git-tracked** filer med JWT/tokens |
| **P1** | 3 funn — untracked env-cluster med live credentials; smoke meta med passord; prod env-backup på disk |
| **P2** | 4 funn — commit-msg-søppel; `.gitignore`-gap; 275 MB zip-artefakter; dupliserte MCP/SQL-spikes |
| **Umiddelbar handling** | Slett/roter credentials i untracked env-filer **utenfor git**; utvid `.gitignore`; rydd root |

---

## Funn (staff-level)

### A-P1-01 — Untracked `.env*` cluster med live credentials

**Severity:** P1 · **Rolle:** DEVOPS  
**Bevis:** 14 filer scannet med mønstre `eyJ…`, `SUPABASE_SERVICE_ROLE_KEY`, `whsec_`, SMTP-pass m.m. (shell scan 2026-05-25; innhold ikke reprodusert her).  
**Git:** Alle `??` untracked; `git log --all` = **ingen historikk** for disse filene.  
**`.gitignore`:** Kun `.env`, `.env.local`, `.env.*.local` — **ikke** `.env.staging-check`, `.env.*.tmp`, `.env.*-check`.  
**Anbefaling:** SLETT lokalt etter verifisering; legg til `.env.*.tmp`, `.env.*-check`, `.env.*-backup`, `.env.vercel.pull.*` i `.gitignore`; vurder rotation av eksponerte nøkler hvis filer har delt maskin/backup.

### A-P1-02 — `.smoke-provision.meta.json` plaintext passord

**Severity:** P1 · **Rolle:** DEVOPS  
**Bevis:** Fil åpnet L1 — `"password":"[REDACTED]"` sammen med `userId`, `email`, `companyId`.  
**Git:** Untracked; ingen historikk.  
**Anbefaling:** SLETT; bruk env-var eller `.tmp/` (gitignored) for smoke-provision metadata.

### A-P1-03 — `.env.local.prod-backup` full prod snapshot

**Severity:** P1 · **Rolle:** DEVOPS  
**Bevis:** Keys inkl. `SUPABASE_SERVICE_ROLE_KEY`, `LP_SMTP_PASS`, `SANITY_*`, `CRON_SECRET` (keys-only listing L1–25).  
**Git:** Untracked; ingen historikk.  
**Anbefaling:** SLETT umiddelbart fra workspace; lag aldri prod-backup utenfor sikret secret store.

### A-P2-01 — 40× `.commit_msg_*.txt` i repo-root

**Severity:** P2 · **Rolle:** DEVOPS  
**Bevis:** Alle 40 filer åpnet (første linje); commit-melding-utkast fra marathon (dc-032, tpt-b-7b, k4, polish, osv.).  
**Git:** Untracked.  
**Anbefaling:** SLETT eller FLYTT til `.tmp/`; legg `/.commit_msg_*.txt` i `.gitignore`.

### A-P2-02 — `.gitignore` dekker ikke spike-mønstre

**Severity:** P2 · **Rolle:** DEVOPS  
**Bevis:** `.gitignore` L11–14 vs faktiske untracked filer (`git check-ignore` = false for 12+ env-spikes).  
**Anbefaling:** Utvid gitignore (se §Anbefalt gitignore-patch).

### A-P2-03 — Umbraco zip-artefakter (~275 MB)

**Severity:** P2 · **Rolle:** DEVOPS  
**Bevis:** `umbraco-clean.zip` 135 782 572 B; `umbraco-robots-only.zip` 136 920 737 B; `*.zip` i `.gitignore` L93.  
**Anbefaling:** SLETT fra disk; behold kilde i `Umbraco/` / `umbraco17/`.

### A-P2-04 — Root MCP/SQL duplikater av migrasjoner

**Severity:** P2 · **Rolle:** BACKEND+DEVOPS  
**Bevis:** `mcp_apply_min.json` L1 — `project_id` + full `lp_order_set` SQL (652+ linjer); matcher `supabase/migrations/20260516140000_repair_lp_order_set_and_vat_rate_tolking.sql`.  
**Anbefaling:** SLETT etter bekreftet apply; én sannhetskilde = `supabase/migrations/`.

### A-P3-01 — `queue.json` tom stub

**Severity:** P3 · **Rolle:** DEVOPS  
**Bevis:** Fil åpnet — innhold `[]`; `.gitignore` L44 dekker.  
**Anbefaling:** KEEP (korrekt ignorert).

---

## A.1 — Full fil-inventar

**Kolonner:** Fil-åpnet = ja med linje-bevis der relevant.

### Env-filer

| Fil | Kategori | Secret-risiko | Gitignored | Eksponert historikk | Anbefaling | Fil-åpnet |
| --- | --- | --- | --- | --- | --- | --- |
| `.env.k6-staging-verify.tmp` | WORKING | **JA** (JWT, service_role) | Nei | Nei | SLETT | ja — keys L1–25 |
| `.env.local.prod-backup` | SECRET | **JA** (full prod) | Nei | Nei | **SLETT** | ja — keys L1–25 |
| `.env.postdeploy.example` | DELIVERABLE | Nei | Nei (tracked) | ja (3970507f) | KEEP | ja — var-navn only |
| `.env.preview-cron.tmp` | WORKING | **JA** | Nei | Nei | SLETT | ja — scan |
| `.env.prod-k6.tmp` | WORKING | **JA** (K6 prod) | Nei | Nei | SLETT | ja — keys L1–25 |
| `.env.sentry-diag-check` | WORKING | **JA** | Nei | Nei | SLETT | ja — scan |
| `.env.sentry-diag-preview` | WORKING | **JA** | Nei | Nei | SLETT | ja — scan |
| `.env.sentry-staging-check` | WORKING | **JA** | Nei | Nei | SLETT | ja — scan |
| `.env.staging-check` | WORKING | **JA** | Nei | Nei | SLETT | ja — keys L1–25 |
| `.env.staging-check.tmp` | WORKING | **JA** | Nei | Nei | SLETT | ja — scan |
| `.env.staging-pull.tmp` | WORKING | **JA** | Nei | Nei | SLETT | ja — scan |
| `.env.vercel.local` | WORKING | **JA** | **Ja** | Nei | SLETT lokalt | ja — scan |
| `.env.vercel.pull.checkpoint` | WORKING | **JA** | Nei | Nei | SLETT | ja — scan |
| `.env.local` | WORKING | **JA** | **Ja** | Nei | KEEP lokalt | ja — keys (gitignored) |
| `.env.example` | DELIVERABLE | Lav (var-navn) | Nei (tracked) | ja | KEEP | ja — 16 var-navn |

### MCP / migrasjon-spikes

| Fil | Kategori | Secret-risiko | Gitignored | Eksponert | Anbefaling | Fil-åpnet |
| --- | --- | --- | --- | --- | --- | --- |
| `.mcp_apply_tpt_b6.json` | WORKING | Nei | Nei | Nei | SLETT (applied) | ja — L1–25 SQL payload |
| `mcp_apply_clean.json` | WORKING | Nei | Nei | Nei | SLETT | ja — scan |
| `mcp_apply_min.json` | WORKING | Nei | Nei | Nei | SLETT | ja — L1 full SQL |
| `mcp_patch13_approve.sql` | WORKING | Nei | Nei | Nei | SLETT | ja — header |
| `mcp_patch13_reject.sql` | WORKING | Nei | Nei | Nei | SLETT | ja — header |
| `mcp_patch13_rpc.json` | WORKING | Nei | Nei | Nei | SLETT | ja — scan |
| `mcp_patch13_rpc_clean.json` | WORKING | Nei | Nei | Nei | SLETT | ja — scan |
| `mcp_patch13_rpc_part2.sql` | WORKING | Nei | Nei | Nei | SLETT | ja — header |
| `.migration_execute_payload.json` | WORKING | Nei | Nei | Nei | SLETT | ja — scan |
| `.migration_tpt_a2.sql` | WORKING | Nei | Nei | Nei | SLETT | ja — header |
| `migration_min.sql` | WORKING | Nei | Nei | Nei | SLETT | ja — L1–30 |
| `apply_payload.json` | WORKING | Nei | Nei | Nei | SLETT | ja — scan |
| `apply_payload_string.txt` | WORKING | Nei | Nei | Nei | SLETT | ja — scan |
| `exec_compact_one_line.txt` | WORKING | Nei | Nei | Nei | SLETT | ja — L1 |
| `exec_only_min.json` | WORKING | Nei | Nei | Nei | SLETT | ja — scan |
| `exec_sql_only.json` | WORKING | Nei | Nei | Nei | SLETT | ja — scan |
| `exec_utf8.json` | WORKING | Nei | Nei | Nei | SLETT | ja — scan |
| `invoke_apply_migration.json` | WORKING | Nei | Nei | Nei | SLETT | ja — scan |

### P3M3 audit-artefakter (DC-011 / prod-check)

| Fil | Kategori | Secret-risiko | Gitignored | Eksponert | Anbefaling | Fil-åpnet |
| --- | --- | --- | --- | --- | --- | --- |
| `.p3m3-check-chunks.json` | EVIDENCE | Nei | Nei | Nei | FLYTT → `.tmp/` eller SLETT | ja — scan |
| `.p3m3-check-results.json` | EVIDENCE | Nei | Nei | Nei | FLYTT → `.tmp/` | ja — scan |
| `.p3m3-chunk0.sql` | EVIDENCE | Nei | Nei | Nei | FLYTT → `.tmp/` | ja — L1 EXISTS queries |
| `.p3m3-chunk1.sql` | EVIDENCE | Nei | Nei | Nei | FLYTT → `.tmp/` | ja — L79 policy check |
| `.p3m3-chunk2.sql` | EVIDENCE | Nei | Nei | Nei | FLYTT → `.tmp/` | ja — header |
| `.p3m3-classifications.json` | EVIDENCE | Nei | Nei | Nei | FLYTT → `.tmp/` | ja — L454 policy names |
| `.p3m3-mini-0.sql` … `.p3m3-mini-11.sql` (12) | EVIDENCE | Nei | Nei | Nei | FLYTT → `.tmp/` | ja — mini-0 L1–15 |
| `.p3m3-mini-chunks.json` | EVIDENCE | Nei | Nei | Nei | FLYTT → `.tmp/` | ja — scan |
| `.p3m3-parse.json` | EVIDENCE | Nei | Nei | Nei | FLYTT → `.tmp/` | ja — L371 |
| `.p3m3-q0-oneline.txt` | EVIDENCE | Nei | Nei | Nei | SLETT | ja — scan |
| `.p3m3-repo-only.txt` | EVIDENCE | Nei | Nei | Nei | KEEP-DOKUMENTÉR i audit | ja — L154 migration ref |
| `.p3m3-sample.txt` | EVIDENCE | Nei | Nei | Nei | SLETT | ja — L1–30 migration list |

### TPT marathon-spikes

| Fil | Kategori | Secret-risiko | Gitignored | Eksponert | Anbefaling | Fil-åpnet |
| --- | --- | --- | --- | --- | --- | --- |
| `.tpt_a2_query.json` | WORKING | Nei | Nei | Nei | SLETT | ja — TPT-A-2 SQL string |
| `.tpt_b2_apply_staging.json` | WORKING | Nei | Nei | Nei | SLETT | ja — scan |
| `.tpt_b2_migration.json` | WORKING | Nei | Nei | Nei | SLETT | ja — scan |
| `.tpt_b3_query.txt` | WORKING | Nei | Nei | Nei | SLETT | ja — L101 grants |
| `.tpt_b6_migration_payload.json` | WORKING | Nei | Nei | Nei | SLETT | ja — scan |
| `.tpt_b7_chunk0.sql` | WORKING | Nei | Nei | Nei | SLETT | ja — header |
| `.tpt_b7_chunk1.sql` | WORKING | Nei | Nei | Nei | SLETT | ja — L362 RPC |
| `.tpt_b7_exec0.sql` | WORKING | Nei | Nei | Nei | SLETT | ja — duplicate chunk0 |
| `.tpt_b7_exec1.sql` | WORKING | Nei | Nei | Nei | SLETT | ja — duplicate chunk1 |

### Smoke / schema / route-inventory

| Fil | Kategori | Secret-risiko | Gitignored | Eksponert | Anbefaling | Fil-åpnet |
| --- | --- | --- | --- | --- | --- | --- |
| `.smoke-provision.meta.json` | SECRET | **JA** (password) | Nei | Nei | **SLETT** | ja — L1 JSON |
| `.smoke-provision.sql` | WORKING | Nei (UUIDs only) | Nei | Nei | FLYTT → `scripts/smoke/` | ja — L1–20 INSERT |
| `.tmp_public_schema.sql` | DEAD | Nei | Delvis (`/.tmp_*`) | Nei | SLETT | ja — **EMPTY** |
| `.tmp_remote_types.ts` | WORKING | Nei | Delvis | Nei | FLYTT → `.tmp/` | ja — L1–15 Database type |
| `.dc011-inventory.json` | EVIDENCE | Nei | Nei | Nei | FLYTT → `docs/audit/` | ja — L1–18 route inventory |
| `.dc028-secret.tmp` | SECRET | **Mulig** (32-char token) | Nei | Nei | SLETT + rotate | ja — L1 |

### Audit / npm / logs / misc

| Fil | Kategori | Secret-risiko | Gitignored | Eksponert | Anbefaling | Fil-åpnet |
| --- | --- | --- | --- | --- | --- | --- |
| `.audit-full.json` | EVIDENCE | Nei | Nei | Nei | SLETT (npm audit dup) | ja — L1–30 moderate CVEs |
| `audit-before.json` | EVIDENCE | Nei | Nei | Nei | SLETT | ja — L1–40 |
| `audit-prod-before.json` | EVIDENCE | Nei | Nei | Nei | SLETT | ja — scan |
| `audit-v4.cjs` | DELIVERABLE | Nei | Nei | Nei | FLYTT → `scripts/audit/` | ja — L1–80 AST tool |
| `dev-smoke.err.log` | DEAD | Nei | Ja (`*.log`) | Nei | SLETT | ja — EADDRINUSE :3000 |
| `dev-smoke.out.log` | DEAD | Nei | Ja | Nei | SLETT | ja — next dev start |
| `diff-stat.txt` | EVIDENCE | Nei | Nei | Nei | SLETT | ja — L1–30 git diff stat |
| `.vercel-trigger.txt` | DEAD | Nei | Nei | Nei | SLETT | ja — L1 deploy timestamp |
| `queue.json` | DEAD | Nei | **Ja** | Nei | KEEP (ignored) | ja — `[]` |
| `umbraco-clean.zip` | DEAD | Nei | Ja (`*.zip`) | Nei | **SLETT** (136 MB) | ja — size verified |
| `umbraco-robots-only.zip` | DEAD | Nei | Ja | Nei | **SLETT** (137 MB) | ja — size verified |

---

## A.3 — `.commit_msg_*.txt` (40 filer)

**Kategori:** WORKING / DEAD (commit-utkast)  
**Secret-risiko:** Nei (ingen tokens i first-line review)  
**Git:** Alle untracked (`??`)  
**Innhold vs historikk:** Utkast som **sannsynligvis** matcher commits allerede på branch (f.eks. `.commit_msg_dc032.txt` ↔ DC-032 fixes), men filene er **ikke** konsumert av git — de er manuelle `-F` drafts.

| Mønster | Antall | Eksempler (fil-åpnet L1) |
| --- | ---: | --- |
| `fix(dc-*)` | 5 | dc018, dc019, dc029, dc032, dc032_week2 |
| `fix(tpt-b-7b*)` | 5 | hotfix, hotfix2–4, docs |
| `fix(k4*)` | 6 | scope, assign, export, close, esg, esg2 |
| `docs/chore/style` | 14 | polish1–9, phase_a/d/e, prx1, kreditnota |
| `feat/fix other` | 10 | k1, k2, tpt_b6, b5b, flaky_fix, k6_thresholds |

**Anbefaling:** SLETT alle 40 etter spot-check mot `git log --oneline -40` (ingen unik info som ikke finnes i historikk).

---

## `.gitignore`-gap-analyse

| Mønster | Dekket i `.gitignore`? | Eksempel-filer som lekker |
| --- | --- | --- |
| `.env` | ✅ L12 | — |
| `.env.local` | ✅ L13 | — |
| `.env.*.local` | ✅ L14 | — |
| `.env.vercel.local` | ✅ (matcher `.env.*.local`) | — |
| `.env.*.tmp` | ❌ | `.env.prod-k6.tmp`, `.env.preview-cron.tmp` |
| `.env.*-check` | ❌ | `.env.staging-check`, `.env.sentry-diag-check` |
| `.env.*-backup` | ❌ | `.env.local.prod-backup` |
| `.env.vercel.pull.*` | ❌ | `.env.vercel.pull.checkpoint` |
| `/.commit_msg_*.txt` | ❌ | 40 filer |
| `/.p3m3-*` `/.tpt_*` | ❌ | marathon spikes |
| `/mcp_*.json` `/apply_payload*` | ❌ | MCP apply dumps |
| `*.zip` | ✅ L93 | untracked men 275 MB på disk |

### Anbefalt gitignore-patch (for implementeringssprint, ikke i denne READ-ONLY sesjonen)

```
.env.*.tmp
.env.*-check
.env.*-backup
.env.vercel.pull.*
/.commit_msg_*.txt
/.p3m3-*
/.tpt_*
/.mcp_*
/mcp_apply*.json
/mcp_patch13*
/apply_payload*
/exec_*.json
/exec_*.txt
/invoke_apply_migration.json
/migration_min.sql
/.smoke-provision.*
/.dc*-secret.tmp
```

---

## K6 results — relatert funn (utenfor A.1-liste, oppdaget under secret-scan)

| Fil | Tracked | Secret | Anbefaling |
| --- | --- | --- | --- |
| `scripts/k6/results/*.json` | **Nei** (kun `.gitignore` + `.gitkeep`) | **JA** — plaintext `password` i summary exports | KEEP gitignore; SLETT lokale resultater |

---

## Fase A completeness

| Sub-item | Status | Funn |
| --- | --- | --- |
| A.1 Kandidat-inventar | **COVERED** | 95 filer |
| A.2 Per-fil vurdering | **COVERED** | Tabell over |
| A.3 commit_msg-filer | **COVERED** | 40 / 40 |
| A.4 Leveranse | **COVERED** | Denne filen |

---

## STOP-PUNKT A

**Fase A COMPLETE.** Ingen P0 — ingen tracked secrets.  
**Vent:** `GO Fase B` (monorepo-anatomi, 47+ mapper).

*READ-ONLY — ingen filer slettet i denne sesjonen.*

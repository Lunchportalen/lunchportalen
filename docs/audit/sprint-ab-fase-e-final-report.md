# Sprint AB Fase E — Final Report

**Status**: COMPLETE  
**Backup-tag**: `chore/sprint-ab-fase-e-complete` @ `a6ad60dd`  
**Period**: 2026-05-26 → 2026-05-27 (dag 7+ av Lunchportalen marathon)  
**Test-baseline gjennom hele sprint**: 2389 PASS (regression-free)

## Sammendrag

Fase E ble eksekvert som 8 atomic batches (E.1–E.8) med STOP-PUNKT 1-disiplin mellom pre-flight og execution. Hovedscope: doc/audit-corrections, `.cjs` → `.mjs` modernisering, JSON determinisme via shared helper, weekly maintenance CI, og governance-policy for backoffice.

Cursor som executor; Claude som staff reviewer/architect.

## Batch-oversikt

| Batch | Squash | PR | Scope |
|---|---|---|---|
| E.1 | e56fc956 | #39 | Sprint AA backlog state-correction + check:links scaffold |
| E.2 | b616523b | #40 | CONVENTIONS.md etablert + 4 docs/security/ case-renames |
| E.3 | b678eb81 | #41 | ISO27001 alignment matrix flytt + docs/README.md hub-index |
| E.4 | b5ffa8b2 | #42 | Design constitution flytt + codex-design-system script update |
| E.5 | a183ea73 | #43 | audit-v4 `.cjs` → `.mjs` modernisering + apply-dead-file-status comment-fix |
| E.6 | b668f8a7 | #44 | JSON determinisme (lib-ai-keep-closure + k4) + CONVENTIONS policy |
| E.7 | 0b9bcb91 + 398a0c9b | #45, #46 | Weekly repo-intelligence CI + stable-json helper (5 commits + fix-up for cross-OS) |
| E.8 | a6ad60dd | #47 | Backoffice policy + governance hub + ISO A.9 mapping |

## V-gates etablert

| Gate | Batch | Purpose |
|---|---|---|
| V.8.x | E.1 | check:links (525 → 555 lenker over sprint) |
| V.14 | E.2 | Case-collision integrity (Windows-trygg two-step rename) |
| V.15 | E.2/E.6/E.7 | CONVENTIONS.md sanity (utvidet med JSON-policy + workflow enforcement) |
| V.16 | E.3 | Compliance-stub integrity |
| V.17 | E.3 | IA-index integrity |
| V.18 | E.4 | Codex-design-system script integrity (runtime path-verify) |
| V.19 | E.5 | Audit-script integrity (stdout-diff pre/post-modernize) |
| V.20 | E.6/E.7 | JSON determinisme (2× MD5 + trailing `\n` + ingen timestamps/random) |
| V.21 | E.7 | Workflow + helper integrity (YAML valid + dry-run verify) |

## Hovedleveranser

| Leveranse | Batch | Detalj |
|---|---|---|
| `docs/CONVENTIONS.md` | E.2 → E.6 → E.7 | Etablert E.2; +42 LOC «Generated JSON artifacts» (E.6); workflow-enforcement (E.7). **135 LOC** total post-E.8 |
| `docs/governance/backoffice-policy.md` | E.8 | **130 LOC** — kode-sannhet-verifisert (layout guards + routeGuard pattern) |
| `docs/governance/README.md` | E.8 | **25 LOC** — governance hub-index |
| `docs/README.md` | E.3 | **38 LOC** — docs hub-index (6 hubs + audit-record block) |
| `docs/compliance/iso27001-alignment-matrix.md` | E.3 + E.8 | Flyttet til compliance hub (E.3); 15 internal refs refreshed; A.9 row update (E.8). **227 LOC** |
| `docs/engineering/design-constitution.md` | E.4 | Flyttet fra `design/DESIGN_BRIEF.md`. **323 LOC** |
| `scripts/check-doc-links.mjs` | E.1 | `npm run check:links` — 525 lenker baseline → 555 post-E.8 |
| `scripts/audit/audit-v4.mjs` | E.5 | Modernisert fra root `audit-v4.cjs` (ESM) |
| `scripts/audit/lib/stable-json.mjs` | E.7 | **69 LOC** — `sortKeys`, `stableStringify`, `writeStableJson` + `--self-test` |
| `scripts/scanRepo.ts` | E.7 | Deterministic via stable-json; `last_scan` fjernet; `stableCompare(..., 'en')`; `next-env.d.ts` excluded |
| `.github/workflows/weekly-repo-intelligence-refresh.yml` | E.7 | **114 LOC** — cron Søndag 03:00 UTC + `workflow_dispatch`; V.20 2× baseline verify |
| Generated JSON (10 filer) | E.6/E.7 | `repo-intelligence/` (8) + `scripts/audit/` (2): deterministic, trailing `\n`, 2× MD5 verified on Linux CI |

**PR-telling:** 10 squash-merges til main (#39–#47 inkl. E.7 fix-up #46). Pre-flight backup: `chore/sprint-ab-fase-e-pre-backup` @ `2edd001e`. Post-close backup: `chore/sprint-ab-fase-e-complete` @ `a6ad60dd`.

## Lessons learned

### 1. V.20 cross-OS strategi

E.7 dry-run feilet i CI selv om lokal-test passerte. Root-cause: `localeCompare` uten explicit locale + `app/next-env.d.ts` inkludert på Linux men ikke Windows. Fix-up #46 introduserte:

- `stableCompare(..., 'en')` — eksplicit locale
- `GLOB_IGNORE` constant inkluderende `next-env.d.ts`
- V.20-test sammenligner 2× baseline (ikke git HEAD)

**Takeaway**: CI på Linux er korrekt sannhetskilde for determinisme. Lokal Windows-test fanger ikke locale/glob-drift.

### 2. Monorepo-erkjennelse

Lunchportalen-repoet er monorepo: Next.js (`app.lunchportalen.no`) + Umbraco 17 (`lunchportalen.no`, undermappe `umbraco17/lunchportalen/`). Sprint AB skannet og refaktorerte begge systemer, men eksplisitt monorepo-artikulering manglet i sprint-prompts. Fremtidige sprints bør være klar over: scanRepo, audit-scripts, og CONVENTIONS dekker begge systemer.

### 3. STOP-PUNKT-disiplin

7 av 8 batches fulgte STOP-PUNKT 1-mønsteret (pre-flight → Thomas-beslutning → execution). E.8 brøt mønsteret og gikk direkte til execution uten Thomas-input. Resultat: god leveranse, men prosess-konsistens er viktig for review-trygghet. For fremtidige sprints: executor bør aldri overskride STOP-PUNKT selv hvis neste steg virker åpenbart.

### 4. Stale committed JSON er phantom drift

E.6 lib-ai-keep-closure var ikke bare «determinisme-bug» — det var stale commit som divergerte 484 linjer fra fresh script-output (matchet Fase D dead-code fjerning). Generated artifacts MÅ matche source-of-truth i hver commit. Hvis ikke: hver utvikler-run produserer fake git-diff.

### 5. Helper-utility-terskel: 3+ call-sites

`stable-json.mjs` ble meningsfull i E.7 fordi scanRepo bekreftet 3-script-terskel (lib-ai-keep-closure + k4 + scanRepo). Inline fix var korrekt i E.6 fordi terskel ikke var nådd. Mønster: ikke premature abstraction, men konsoliderer når pattern repeats 3+ ganger.

## Fase F backlog (prioritert)

| # | Item | Priority | Source | Reason |
|---|---|---|---|---|
| 1 | GitHub Actions Node 24 migration | **HIGH** | E.7 deprecation warning | Forced deprecation Sep 16, 2026 |
| 2 | uSync aktivering for Umbraco schema | **HIGH** | E.8 close-discussion | Schema-versjonering, DD-relevant |
| 3 | Dokumenter monorepo-arkitektur eksplisitt | MEDIUM | Fase E lesson | DD-team må forstå struktur |
| 4 | Verifiser selektiv CI/deploy for monorepo | MEDIUM | Fase E lesson | Umbraco kun ved umbraco17/-endring |
| 5 | auditReport.json cross-OS repo_root fix | MEDIUM | E.7 pre-flight | Cross-OS commit-drift |
| 6 | tasks.json determinisme | LOW | E.7 pre-flight | Cosmetic noise |
| 7 | 5 `.cjs` configs modernisering | LOW | E.5 backlog | Hygiene |
| 8 | docs/ root 32 UPPERCASE naming-sweep | LOW | E.2 backlog | Naming consistency |
| 9 | docs/design-brief.md source-of-truth-konflikt | MEDIUM | E.4 finding | UI-design canonical kilde |
| 10 | Audit-script «v4»-suffix descriptive rename | LOW | E.5 backlog | Naming |
| 11 | Console emoji ASCII-safety (Windows DEV) | LOW | E.5 backlog | Portabilitet |
| 12 | docs/governance/backoffice-policy.md Azure-spesifisering | LOW | E.8 review | Q3 review fyll — Azure App Service + Azure SQL for Umbraco |

## Acknowledgments

Cursor som executor leverte staff-grade execution gjennom alle 8 batches:

- 10 squash-merges til main (#39–#47, inkl. E.7 fix-up #46)
- 2389 test-baseline regression-free
- 0 prod-incidents
- Exceptional recovery på E.7 dry-run (cross-OS fix via #46)
- Kode-sannhet-verifiserte claims i E.8 backoffice-policy

Pre-flight + STOP-PUNKT-disiplin (7/8) muliggjorde at staff-decisions ble informert av faktiske repo-funn, ikke antakelser.

# GLOBAL INVOICE-ONLY RELEASE BASELINE

**Status:** PHASE 0 COMPLETE · Autoritativ Git-sannhet etablert
**Dato:** 2026-07-13
**Branch:** `release/global-invoice-only-foundation`
**Betalingsmodell:** invoice_only (ingen Stripe — hard lov for dette release-toget)

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. SHA-identitet

| Element | SHA | Beskrivelse |
|---|---|---|
| **Previous main SHA** | `dae5e5ae` | origin/main før Fase 1-merge (docs-commits etter `13aa59a8`) |
| **Production SHA** | `ada0183b` | «release: global launch production candidate» — kjører på app.lunchportalen.no (verifisert via `/api/health` `data.version`), deployet 2026-07-11 fra `fix/go-operator-open-pr`-linjen |
| **Integrated SHA** | `d645873f` | origin/main i dag = squash-merge av PR #487 (`release/fase-1-release-sannhet`) |
| **Baseline-branch HEAD** | = `d645873f` + baseline-committen (denne filen) | `release/global-invoice-only-foundation` er opprettet fra origin/main |

## 2. Commit ancestry (main/prod-divergens forklart)

```
13aa59a8  feat(ops): add GO operator automation (#483)   ← merge-base(ada0183b, origin/main)
   ├─ production-linjen (fix/go-operator-open-pr):
   │    9b8655a9  fix(ops): open GO Operator evidence PRs      (patch-identisk med 56bbe083/#484 på main)
   │    ada0183b  release: global launch production candidate  ← PRODUCTION
   │    4e17bb70  feat(i18n): complete 21 locale end-to-end support   (var upushet lokalt)
   │    a9c3e0fd  fix(global): align platform to 21 canonical country markets  (var upushet lokalt)
   │
   └─ main-linjen:
        f3ca9670 → f84edd29 → 6b465a48 → 56bbe083 (#484) → dae5e5ae (#485)
        d645873f (#487)  ← squash av release/fase-1-release-sannhet som no-ff-merget
                            hele production-linjen (t.o.m. a9c3e0fd) inn i main-linjen
```

**Divergensårsak:** Production ble deployet 2026-07-11 fra `fix/go-operator-open-pr`-branchen (SHA `ada0183b`), ikke fra main. Main fortsatte parallelt med docs-/evidence-PR-er. Fase 1 (PR #487, merget 2026-07-13 14:30 UTC) lukket divergensen innholdsmessig.

**SHA-ancestry-merknad:** Repoets branch-ruleset tvinger squash-merge på main. `ada0183b` er derfor IKKE en git-ancestor av `d645873f`, men **treet til origin/main er verifisert identisk** med treet til `release/fase-1-release-sannhet` (`git diff` = tom), hvor `ada0183b`, `4e17bb70` og `a9c3e0fd` ER ancestors (`git merge-base --is-ancestor` = true for alle tre). Full commit-lineage er bevart på origin i branchen `release/fase-1-release-sannhet`. Fra neste deploy fra main finnes én SHA-sannhet.

## 3. Included commits (innhold i baseline)

| Commit | Innhold | Hvordan inkludert |
|---|---|---|
| `ada0183b` | All kode som faktisk kjører i production (global launch candidate: cron-auth-herding, kill-switches, e-post-i18n, migrasjoner 20260811–20260814, deprecation av bulk-set/cancel-legacy m.m.) | Via PR #487 (tree-verifisert) |
| `4e17bb70` | Nederlandsk (nl) komplett: katalog 1906 nøkler, e-postkopi, migrasjoner 20260815/20260816, fixtures + tester | Via PR #487 |
| `a9c3e0fd` | Godkjent 21-country-korreksjon: `lib/markets/supportedMarkets.ts` (21 land / 15 språk / 24 markedslocales), 5 nye språkkataloger (pl, ro, cs, pt, el), fr-CA, UK→GB, migrasjon 20260817, fail-closed gates | Via PR #487 |
| `e8d28359`..`458bda79` (5 commits) | Fase 1: truth-audit-docs committet, TECH-DEBT OPS-001 lukket, go-operator-ledger synket m/test, SOT-scan-perf-fiks, CI-testfiks (kill-switch-mock), mojibake-fiks ARCHITECTURE.md | Via PR #487 |

## 4. Excluded commits (bevisst utelatt)

| Kilde | Hva | Hvorfor |
|---|---|---|
| PR #486 (`chore/auto-refresh-29179427749`) | Ukentlig repo-intelligence-refresh (automatisert) | Ikke release-relevant; eget automatisert løp |
| Lokal branch `fix/correct-21-country-market-model` | Ingen unike commits igjen | Fullt absorbert i main (verifisert: branch ⊂ main, 0 unike endringer utover det main allerede har) |
| Lokale untracked filer | `scripts/temp-*.mjs` (25+), `.pr-body-*.md`, `pnpm-lock.yaml`/`pnpm-workspace.yaml`, `.env.preview.verify`, `temp/`, `.claude/`, `.go-operator/latest-report.json` | «Ingen andre tilfeldige lokale endringer» — engangs-scripts, verktøystøy og env-artefakter hører ikke til release-baseline |
| 180+ historiske branches (lokale + remote) | Gamle feature-/fix-/docs-linjer | Alle release-relevante endringer er allerede på main; ingen av dem inneholder production-kode som ikke er i baseline |

## 5. Migrations

**Included i repo/baseline (aktive, t.o.m.):** `20260528000000` (baseline) → `20260817120000_21_country_market_correction` — 68 migrasjoner totalt.

Relevante for dette release-toget:

| Versjon | Innhold | Production-status |
|---|---|---|
| 20260729–20260809 | Global Billing Engine-fundament (commission-kjeden, invoice_only-policy, payment-readiness) | **Applied** 2026-07-11 (operatørgodkjent) |
| 20260810 | MSDI localized SOT snapshot trigger alignment (F4b) | **Applied** |
| 20260811–20260814 | Auth-hook arkiv-guard, company preferred_locale, markets launch readiness, market-timezone cutoff | **Applied** 2026-07-11 |
| 20260815–20260816 | Nederlandsk locale-CHECK-utvidelser | **Applied** 2026-07-13 (Fase 1) |
| 20260817 | 21-country market correction (additiv; AU/SG/LU pensjonert, PL/RO/CZ/PT/GR + fr-CA lagt til, CHECKs → 15 språk) | **Applied** 2026-07-13 (Fase 1) |

**Production migrations pending: INGEN.** Prod-ledger-topp = `20260817120000` (read-only verifisert mot hosted ledger 2026-07-13). Staging-ledger er identisk. Repo == staging == production.

Kontrollpunktet «migrasjonshistorikk frem til 20260814120000» fra prompten reflekterte tilstanden FØR Fase 1; `20260815`–`20260817` ble applied i Fase 1 med egen verifisering (se `docs/evidence/release-truth-fase1-2026-07-13.md`).

## 6. Exact rollback base

| Nivå | Rollback-punkt |
|---|---|
| **Git (baseline-branch)** | Slett/reset `release/global-invoice-only-foundation` — branchen er ren fra `d645873f` |
| **Git (main)** | Revert `d645873f` gjenoppretter main til `dae5e5ae` (previous main SHA) |
| **Production-kode** | Uendret av Phase 0 — production kjører fortsatt `ada0183b` (deployment `lunchportalen-cuowxtqv7`); ingen deploy utført |
| **Production-DB** | Ingen mutasjon i Phase 0. (Fase 1-migrasjonenes dokumenterte rollback: re-aktiver AU/SG/LU, deaktiver de 6 nye markets-radene; CHECK-utvidelser harmløse — se `docs/21-COUNTRY-MARKET-CORRECTION-PLAN.md`) |

## 7. Akseptanse-verifisering (Phase 0)

| Krav | Resultat |
|---|---|
| Én ren integrasjonsbranch | `release/global-invoice-only-foundation` fra origin/main, 0 konflikter (alt allerede integrert via PR #487) |
| Ingen tapte produksjonsendringer | Tree-paritet main == fase1-branch (tom diff); `ada0183b` ancestor av fase1-branch; diff `ada0183b`→main inneholder KUN additive 21-country-/språk-/docs-/test-/truth-filer (85 filer, ingen app-runtime-regresjoner) |
| Main/prod-divergens forklart | Seksjon 2 |
| 21-country code bevart | `verify-21-country-markets.mjs` PASS · `verify-21-language-e2e.mjs` PASS (24/24 locales, 15/15 språk) |
| typecheck / lint / build / Golden Path | Se gate-tabellen i sluttrapporten (alle PASS ved commit-tidspunkt) |
| Ingen production mutation | Kun read-only ledger-/health-lesing; ingen deploy, ingen migrasjon, ingen env-endring |

**STOPP.** Dette dokumentet autoriserer ikke deploy, migrasjon, Stripe-konfigurasjon eller SOT-endringer. Neste fase krever egen prompt.

# Release Truth — Fase 1 (release-sannhet og deploy-hygiene)

**Status:** Evidence archived · **FASE 1 GJENNOMFØRT**
**Date:** 2026-07-13
**Audit basis:** `docs/audit/IMPLEMENTATION-ORDER.md` Fase 1 (punkt 1–4) · Truth Audit 2026-07-13
**Operator approval:** «Fase 1 fullt ut, med eksplisitt tillatelse til push/merge og staging→prod-migrasjon» (2026-07-13)

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Utgangspunkt (fra Truth Audit)

| Element | Før Fase 1 |
|---|---|
| Production-SHA | `ada0183b` — deployet fra `fix/go-operator-open-pr`-linjen, IKKE ancestor av `origin/main` |
| origin/main | `dae5e5ae` (docs-commits etter `13aa59a8`) |
| Upushede commits | `ada0183b`, `4e17bb70`, `4e17bb70`→`a9c3e0fd` kun lokalt (tap-risiko) |
| Prod-migrasjoner | t.o.m. `20260814120000`; `20260815`–`20260817` kun lokalt |
| Staging-migrasjoner | t.o.m. `20260810120000` (LÅ ETTER PROD — drift) |
| Prod markets-modell | 21 locale-rader = «21 markeder» (feil modell: AU/SG/LU aktive, PL/RO/CZ/PT/GR manglet, BE/CH dobbelttalt, fr-CA manglet) |
| Sannhetsdocs | TECH-DEBT/go-operator hevdet billing-blokk «pending» — motbevist av prod-ledger |

## 2. Utført

### 2.1 Én sannhet: release-linjen inn i main-linjen
- Ny branch `release/fase-1-release-sannhet` fra `origin/main` (`dae5e5ae`).
- Merge (no-ff) av `fix/correct-21-country-market-model` (topp `a9c3e0fd`) — bringer `ada0183b` (production-SHA), `4e17bb70` (15 språk) og `a9c3e0fd` (21-lands-korreksjon) inn i main-linjen. 0 konflikter (`git merge-tree` ren).

### 2.2 Migrasjoner staging → prod (kontrollert)
- **Staging** (`uigxsboqeruxflgzqztl`): `20260811`–`20260817` applied (alignet staging som lå etter prod). Verify: 24 aktive locale-rader · 21 land · AU/SG/LU inaktive · CHECKs = 15 språk. PASS.
- **Production** (`hkpokyapzarefrgqzkos`): dry-run → eksakt `20260815`–`20260817` → apply, exit 0.
- **Pre-apply-sjekk:** alle 9 `organization_billing_profiles` bundet til markeder som forblir aktive (ingen binding til AU/SG/LU).
- **Post-apply verify (prod):** 27 rader totalt (0 slettet) · 24 aktive locale-rader · 21 distinkte aktive land · AU/SG/LU `is_active=false` · 0 profiler på inaktive markeder · begge locale-CHECKs = 15 språk · ledger-topp `20260817120000`.
- **Kodegates:** `verify-21-country-markets.mjs` PASS · `verify-21-language-e2e.mjs` PASS.

### 2.3 Sannhetsdocs synket mot runtime
- `docs/TECH-DEBT.md` OPS-001: lukket (billing-blokken ER i prod; historisk analyse bevart).
- `scripts/go-operator/constants.mjs`: `PRODUCTION_LEDGER_SNAPSHOT` = faktisk prod-ledger t.o.m. `20260817120000`; `PENDING_BILLING_MIGRATIONS` = tom (med dato og begrunnelse).
- `scripts/go-operator/tasks.mjs`: «bulk apply would not be F4b-only»-sjekken korrigert til intensjonen (fail kun når pending er eksakt F4b) — nødvendig følgeendring av ledger-oppdateringen.
- `docs/PRODUCTION-PREFLIGHT-REPORT.md`: Fase 1-seksjon med staging/prod-resultat og rollback.
- Truth Audit-dokumentene (`docs/audit/*.md` 2026-07-13) committet inn i repoet (var kun lokale filer).

## 3. Produksjonspåvirkning

| Dimensjon | Vurdering |
|---|---|
| Data | Additiv: 6 nye markets-rader, 3 rader flagget inaktive, 2 CHECK-utvidelser. 0 DELETEs. Ordre/companies/providers/økonomi urørt |
| Kode i prod | Uendret — production kjører fortsatt `ada0183b`. Gammel kode leser markets trygt (ingen tenants bundet til endrede rader) |
| RLS / tenant-isolasjon | Uendret (ingen policy-/grant-endringer i 20260815–20260817) |
| Golden Path | Uendret (ingen ordre-/statusfiler berørt) |
| Umbraco / Azure / lunchportalen.no | Urørt |
| Stripe | Urørt (invoice_only; ingen Stripe-endringer) |

## 4. Rollback

- **DB:** `UPDATE markets SET is_active=true WHERE country_code IN ('AU','SG','LU'); UPDATE markets SET is_active=false WHERE (country_code, locale) IN (('PL','pl-PL'),('RO','ro-RO'),('CZ','cs-CZ'),('PT','pt-PT'),('GR','el-GR'),('CA','fr-CA'));` CHECK-utvidelser kan stå (kun videre allowlist).
- **Git:** branchen er en ren merge på toppen av main; revert av merge-committen gjenoppretter main-linjen.

## 5. Restgap etter Fase 1 (IKKE lukket her — se IMPLEMENTATION-ORDER Fase 2+)

- Production-deploy av 21-lands-koden (kode-flip) krever egen deploy-GO.
- Språklig innholds-QA (10 kontaminerte kataloger) — Fase 9.
- E1/E2-pengeflyt, Tripletex-kø, provider-UI — Fase 2/3.

**STOP.** Dette dokumentet autoriserer ikke production-deploy, SOT-start, auto-rollout eller ytterligere migrasjoner.

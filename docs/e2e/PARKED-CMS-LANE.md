# Parkert CMS-lane (E2E)

Dokumentasjon for spesifikasjoner som **ikke** kjører i CI E2E «core lane» (`.github/workflows/ci-e2e.yml`). Tall er målt med `npx playwright test … --list --project=chromium` i repoet.

## Hva

### Core lane (kjører i CI)

Seks filer, **49 tester** etter `--grep-invert`:

| Fil | Tester i fil | Merknad |
|-----|----------------|---------|
| `e2e/auth.e2e.ts` | 10 | |
| `e2e/auth-role.e2e.ts` | 2 | |
| `e2e/auth-redirect-safety.e2e.ts` | 6 | |
| `e2e/shells.e2e.ts` | 11 | |
| `e2e/mobile-invariants.e2e.ts` | 13 | 2 tester grep-invert (se under) |
| `e2e/core-flows.e2e.ts` | 10 | 1 test grep-invert (se under) |

**`--grep-invert` (eksakt streng fra `ci-e2e.yml`):**

```text
backoffice content shell|/backoffice/content authenticated
```

**Tre tester ekskludert fra core** (matcher invert-mønsteret; ligger fortsatt i core-filer):

| Testtittel | Fil |
|------------|-----|
| `backoffice content shell loads after auth` | `e2e/core-flows.e2e.ts` |
| `/backoffice/content authenticated: no horizontal overflow` | `e2e/mobile-invariants.e2e.ts` |
| `/backoffice/content authenticated: content heading visible in viewport` | `e2e/mobile-invariants.e2e.ts` |

*(Tittelen `backoffice content shell` i `e2e/visual.e2e.ts` er parkert sammen med hele `visual.e2e.ts`, ikke grep-invert i CI.)*

### Parkert lane (kjører ikke i CI)

**33 `*.e2e.ts`-filer** (60 tester i isolert `--list`) **+** `e2e/backoffice-content-tree-integrity.spec.ts` (1 test, matchet av `testMatch` men ikke med i CI core-invokasjonen) → **61 tester** parkert utenom core (`113` totalt i `e2e/` − `52` i de seks core-filene = **61**).

| # | Fil |
|---|-----|
| 1 | `e2e/ai-cms.e2e.ts` |
| 2 | `e2e/backoffice-content-tree.e2e.ts` |
| 3 | `e2e/backoffice-media-upload-picker.e2e.ts` |
| 4 | `e2e/backoffice-media.e2e.ts` |
| 5 | `e2e/backoffice-releases.e2e.ts` |
| 6 | `e2e/backoffice-smoke.e2e.ts` |
| 7 | `e2e/backoffice-users-smoke.e2e.ts` |
| 8 | `e2e/cms-preview-route-smoke.e2e.ts` |
| 9 | `e2e/editor-save-smoke.e2e.ts` |
| 10 | `e2e/media-flow.e2e.ts` |
| 11 | `e2e/u62-editor-ai-browser-proof.e2e.ts` |
| 12 | `e2e/u72-block-editor-visual-proof.e2e.ts` |
| 13 | `e2e/u81-block-editor-visual-proof.e2e.ts` |
| 14 | `e2e/u85-property-editor-runtime-proof.e2e.ts` |
| 15 | `e2e/u86-property-editor-runtime-proof.e2e.ts` |
| 16 | `e2e/u88-canonical-block-type-proof.e2e.ts` |
| 17 | `e2e/u89-runtime-block-observation.e2e.ts` |
| 18 | `e2e/u90-block-creation-contract-proof.e2e.ts` |
| 19 | `e2e/u90b-block-creation-contract-proof.e2e.ts` |
| 20 | `e2e/u90c-block-creation-contract-proof.e2e.ts` |
| 21 | `e2e/u92-block-entry-shape-proof.e2e.ts` |
| 22 | `e2e/u93-final-contract-proof.e2e.ts` |
| 23 | `e2e/u94-data-type-config-proof.e2e.ts` |
| 24 | `e2e/u94b-data-type-runtime-proof.e2e.ts` |
| 25 | `e2e/u95b-data-types-workspace-runtime-proof.e2e.ts` |
| 26 | `e2e/u96-content-types-element-types-proof.e2e.ts` |
| 27 | `e2e/u96b-content-types-element-types-runtime-proof.e2e.ts` |
| 28 | `e2e/u97b-compositions-structure-templates-proof.e2e.ts` |
| 29 | `e2e/u97e-content-structure-create-flow-proof.e2e.ts` |
| 30 | `e2e/u97i-proof-chain-lock.e2e.ts` |
| 31 | `e2e/u98b-variants-publish-live-proof.e2e.ts` |
| 32 | `e2e/u98c-proof-chain-lock.e2e.ts` |
| 33 | `e2e/visual.e2e.ts` |

**Ekstra (ikke `*.e2e.ts`, fortsatt parkert):** `e2e/backoffice-content-tree-integrity.spec.ts` (1 test).

**u62–u98:** editor/block/CMS proof-kjede (`u62` … `u98c`) + backoffice-smoke/media/releases + `ai-cms`, `media-flow`, `editor-save-smoke`, `cms-preview-route-smoke`, `visual`.

## Hvorfor

- Specene leser **`content_*`** (releases, workflow, audit-log, experiments, analytics) og/eller kaller **`/api/backoffice/**`** med **`LP_CMS_RUNTIME_MODE`** / **`local_provider`** (se f.eks. `e2e/u62-editor-ai-browser-proof.e2e.ts`, `e2e/u98b-variants-publish-live-proof.e2e.ts`).
- **`content_*`-tabeller er ikke deployet til prod** (degraded/empty eller mangler). Se [prod-schema-gaps-2026-05-31.md](../audit/prod-schema-gaps-2026-05-31.md) (CMS / backoffice-seksjonen).
- Core lane skal speile **deployed product** (auth, week/orders, shells, mobile) på **uigx** — ikke hele CMS-laboratoriet i hver PR.

## Status

**Parkert** i påvente av **content_*-liveness-beslutning** (Stage 3-T **parkert-B** i schema-gap-audit). CI kjører kun core (49 tester + anti-skip-gulv `min_expected=45`, `skipped==0`).

## Aktiverings-sjekkliste

1. **Deploy** manglende `content_*`-migrasjoner til målmiljø (staging/prod etter beslutning).
2. **Seed** CMS/backoffice-fixtures (tilsvarende smoke/proof-seed brukt i u97/u98-artifacts).
3. Sett **`LP_CMS_RUNTIME_MODE`** (og ev. `LP_E2E_EXTERNAL_SERVER=1` der proof krever det).
4. **Fjern** `--grep-invert` i `ci-e2e.yml` når de tre core-testene er grønne mot live `content_*`.
5. **Flytt** parkerte specs inn i egen workflow eller utvid core **etter** grønn lokal/CI-kjøring — først **ikke-gating** lane, deretter vurder required.

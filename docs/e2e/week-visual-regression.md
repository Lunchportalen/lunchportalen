# Week visual regression — STEG 0

Deterministic Playwright screenshot baselines for `/week` (employee). Baselines are captured in the **Playwright Docker image** (Linux) so STEG 2–4 token/UI changes produce comparable diffs.

## States & viewports

| State | Fixture | Viewports |
|---|---|---|
| Allergen `declared_empty`, collapsed | Mock `/api/me/user-allergens` | desktop 1280×720, mobile 375×812 |
| Allergen `has_data`, collapsed | Mock allergens (gluten + melk chips) | desktop, mobile |
| Day selected — Tir 02.06 | Mock window + click `2026-06-02` | desktop, mobile |
| Bestilt dag + «Kommende dager» | Tue ACTIVE order + upcoming list | desktop, mobile |

Tolerance: `maxDiffPixelRatio: 0.01` (allows minor antialiasing; not zero).

## Run locally (server must be running)

```bash
npm run build
PORT=3000 npm run start
# separate terminal, with E2E employee creds in env:
LP_E2E_EXTERNAL_SERVER=1 npm run e2e:week-visual
```

## Docker (authoritative baseline capture)

Requires Docker Desktop (Linux engine) and E2E employee creds.

**Host server already running** (after `npm run build` + `PORT=3000 npm run start`):

```bash
bash scripts/e2e/week-visual-docker.sh --update-snapshots
```

**Self-contained** (build + server + Playwright inside container):

```bash
bash scripts/e2e/week-visual-docker.sh --standalone --update-snapshots
```

**CI (Linux, recommended for first baseline on #89-HEAD):**

1. Push branch with this workflow.
2. GitHub → Actions → **CI Week Visual** → Run workflow → branch → `update_snapshots: true`.
3. Download artifact `week-visual-snapshots-linux` and commit under `e2e/week-visual-regression.e2e.ts-snapshots/`.
4. Re-run workflow with `update_snapshots: false` — must pass with 0 diff.

## Approve an intentional visual change (STEG 2+)

1. Confirm the diff in the Playwright HTML report / PR artifact — never blind-update.
2. Re-run baseline capture **in Docker only**:
   ```bash
   bash scripts/e2e/week-visual-docker.sh --update-snapshots
   ```
3. Commit updated files under `e2e/week-visual-regression.e2e.ts-snapshots/`.
4. PR must include: **what changed visually**, **why**, and **before/after screenshots** in the description.

Never run `--update-snapshots` on Windows/macOS for committed baselines — CI uses Linux Docker.

## CI

Workflow `.github/workflows/ci-week-visual.yml` — blocking check on week/employee path changes.

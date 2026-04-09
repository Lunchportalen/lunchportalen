# Phase 1C — Build / CI hardening

## Problem (Phase 1B)

`npm run build:enterprise` feilet lokalt med **JavaScript heap out of memory** under `next build` (Node ~2 GB default heap på Windows).

## Løsning (reproduserbar)

### 1. `package.json`

- **`build`**: `next build` kjøres med `cross-env NODE_OPTIONS=--max-old-space-size=8192`.
- **`build:enterprise`**: samme `NODE_OPTIONS` på `next build`-steget (sammen med `RC_MODE=true`).

Standard kommando krever **ikke** manuell `set NODE_OPTIONS` i shell — det ligger i scriptet.

### 2. GitHub Actions

- **`ci.yml`**: `NODE_OPTIONS: --max-old-space-size=8192` på job-nivå (byggejobb).
- **`ci-enterprise.yml`**, **`ci-e2e.yml`**: `NODE_OPTIONS` i `env`.
- **`ci-agents.yml`**: `NODE_OPTIONS` på «Build enterprise»-steget.

## Verifikasjon

- `npm run typecheck` — PASS
- `npm run build:enterprise` — PASS (lokal kjøring: `next build` fullførte, SEO-skript kjørte, exit 0)

## Hvis build fortsatt feiler

- Øk til `12288` eller `16384` på svært store worktrees (oppdater kun `package.json` + workflows konsistent).
- Sjekk at CI ikke overskriver `NODE_OPTIONS` utilsiktet.

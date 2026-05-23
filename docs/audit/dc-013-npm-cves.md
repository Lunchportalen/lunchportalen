# DC-013 npm CVE-fix — 2026-05-23

## Pre-state

Baseline: `npm audit --omit=dev` (prod dependency tree, som deep-crawl).

| Pakke | Severity | CVE / Advisory | Via | Brukt i |
|-------|----------|----------------|-----|---------|
| `next` | HIGH | GHSA-q4gf-8mx6-v5v3, GHSA-8h8q-6873-q5fj, GHSA-26hh-7cqf-hhc6, GHSA-mg66-mrh9-m8jx, GHSA-c4j6-fc7j-m34r, GHSA-492v-c6pp-mqqv, GHSA-267c-6grr-h53f, GHSA-36qx-fr4f-26g5 | Direct `dependencies` | Prod runtime (App Router, middleware, RSC) |
| `lodash` | HIGH | GHSA-r5fr-rjxr-66jc | `graphlib@2.1.8` → `lodash@4.17.23` | Prod dep tree; `graphlib` direct dep (script `audit-v4.cjs`), ikke direkte i `lib/`/`app/` |

Full audit uten `--omit=dev`: 5 HIGH (flatted, minimatch, picomatch m.fl.) — **utenfor scope** (dev-only transitive).

## Fix

| Pakke | Før | Etter | Type |
|-------|-----|-------|------|
| `lodash` | 4.17.23 | 4.18.1 | `npm audit fix` (lockfile resolution under `graphlib`) |
| `next` | 15.5.10 | 15.5.18 | Manual patch bump i `package.json` (`npm audit fix` blocked pga exact pin) |

Ingen endringer i `lib/` eller `app/`. Kun `package.json` + `package-lock.json`.

## Verify

- `rm -rf node_modules && npm ci` — OK
- Test-suite: **2403 PASS**, 0 FAIL
- `npm run typecheck` — PASS
- `npm run lint` — PASS (pre-existing warnings only)

## Post-state

`npm audit --omit=dev`: **high=0, critical=0**, moderate=2 (nodemailer, postcss — utenfor DC-013 HIGH-scope)

| Metric | Verdi |
|--------|-------|
| Prod HIGH+CRITICAL | 0 |
| Test-suite | 2403 PASS |
| Build | Pending Vercel prod deploy |

## Anbefaling

- [x] DC-013 LUKKET — prod HIGH CVEs patched uten runtime-kodeendring
- [ ] Moderate (nodemailer/postcss) — egen oppfølging hvis ønskelig

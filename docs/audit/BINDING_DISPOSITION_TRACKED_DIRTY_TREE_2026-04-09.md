# Binding disposition — tracked dirty tree (vs `HEAD`)

**Date:** 2026-04-09  
**HEAD:** `956901d0d8f0fe43dc6495d225ce84960a686a94`  
**Scope:** `git diff` (working tree vs `HEAD`) only — **no** `git add` / `git commit` / `git restore` in this package. Untracked mass (~**995** paths) is **out of scope** here.

## Command snapshot (this run)

| Command | Result |
|--------|--------|
| `git rev-parse HEAD` | `956901d0d8f0fe43dc6495d225ce84960a686a94` |
| `git diff --cached --name-only` | Empty |
| `git ls-files --others --exclude-standard` | **995** paths (not dispositioned here) |
| `git diff --name-only` | **172** paths |
| `git diff --stat` | **172 files**, **+4306 / −3411** lines |
| `app/**` in diff | **0** files (ingen `app/*` endret i denne treetilstanden) |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (warnings only) |
| `npm run test:run` | PASS — 359 test files passed, 4 skipped |
| `npm run build:enterprise` | PASS — SEO gates OK |

### Tracked diff — toppnivå / andre nivå (tellinger)

| Segment (topp / to nivå) | Filer i diff |
|--------------------------|-------------:|
| `tests/api` | 25 |
| `components/superadmin` | 18 |
| `tests/cms` | 15 |
| `components/admin` | 7 |
| `.github/workflows` | 4 |
| `components/ui` | 4 |
| `tests/rls` | 4 |
| `tests/auth` | 3 |
| `tests/backoffice` | 3 |
| `tests/security` | 3 |
| `components/site` | 3 |
| `e2e/helpers` | 2 |
| `components/nav`, `layout`, `auth`, `orders`, `seo`, `system` | 2 hver |
| Øvrige enkeltfiler / `scripts/*`, `studio/*`, `src/*`, rot-config, `middleware.ts`, `docs/*`, `superadmin/system/*`, m.m. | rest |

**Mønstre (filnavn + stat, ikke innholdslesning av hver diff):**

- **`tests/**`:** Bred dekning (API, CMS, auth, RLS, tenant, kitchen, middleware, …) — typisk **test-/mock-tilpasning** til samme «rescue»-gren som øvrig repo; bygg er grønt.
- **`components/**`:** Blanding av (a) **mange små** endringer i admin/superadmin/ui/nav/…, (b) **store** endringer (`toast.tsx`, `WeekMenuReadOnly.tsx`, `AppFooter.tsx`), (c) **sletting** av rot-marketingfiler (`AppHeader`, `FAQ`, …), (d) **sletting** av `components/site/*`, `components/auth/LoginForm.tsx` — **samme diff kan ikke ærlig besluttes som én enhet**.
- **`superadmin/system/repairs/run/route.ts`:** **Slettet** i diff (`---` i stat) — berører **superadmin system**-flate (frosset i `AGENTS.md` inntil eksplisitt unntak).
- **Konfig / leverandør:** `package.json` + **stor** `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `next.config.ts`, `playwright.config.ts`, `.eslintrc.cjs`, `.gitignore`, `.env.example`, `next-env.d.ts` — samme gren.
- **`middleware.ts`:** Endret (middels diff) — **høyrisiko** fil per prosjektregler; likevel én sammenhengende endring i treet.
- **`src/components/nav/HeaderShell.tsx` + `src/lib/guards/assertCompanyActiveApi.ts`:** Endret — linje med **kanonisk header** / guard.
- **`docs/**` (tracked):** `docs/MEDIA_API_CONTRACT.md`, `docs/audit/U114_scoped_baseline_prep_record.md`, `docs/backoffice/HOME_NODE_BEHAVIOR.md` — **ikke** del av tidligere massiv untracked docs-commit; dette er **endringer på allerede tracked** filer.
- **`plugins/coreBlocks.ts`, `scripts/**`, `studio/**`, `tailwind.config.cjs`, `e2e/*`:** Endret — CMS/CI/studio/e2e-linje.

---

## Binding decisions (one outcome per bucket)

Outcomes: **KEEP IN BASELINE PATH NOW** | **REVERT TO HEAD** | **HOLD OUTSIDE BASELINE NOW** | **MUST SPLIT BEFORE DECISION**

| # | Tracked bøtte | Decision | Hvorfor | Blokkerer baseline? | Neste pakke MAY | Neste pakke MUST NOT |
|---|---------------|----------|---------|---------------------|-----------------|----------------------|
| 1 | **`tests/**` (hele diff-massen)** | **KEEP IN BASELINE PATH NOW** | Speiler nåværende grønne gates; reverting ville løsrive test-sannhet fra kjørende kodebase uten egen bevispakke. | **Ja** inntil committet/ryddet — uklar `git status`. | Commit i ryddig slice sammen med eller etter tilhørende produktendringer. | Revert hele `tests/**` «for å rydde» uten å erstatte med grønt sett. |
| 2 | **`e2e/**` (`e2e/ai-cms.e2e.ts`, `e2e/helpers/*`)** | **KEEP IN BASELINE PATH NOW** | Samme gren som øvrig CMS/navigasjon; bygg grønt. | **Ja** inntil committet. | Commit med e2e-policy. | Ignorere at e2e er del av leveransekvalitet. |
| 3 | **`.github/workflows/**`** | **KEEP IN BASELINE PATH NOW** | CI-kontrakt for enterprise/ e2e / agents; del av samme leveranse. | **Ja** inntil committet. | Commit med forklarende melding. | Revert uten å erstatte CI-sannhet. |
| 4 | **`package.json` + `package-lock.json`** | **KEEP IN BASELINE PATH NOW** | Avhengigheter låst til nåværende grønne toolchain; stor lock-diff hører til samme gren. | **Ja** inntil committet. | Commit; ev. egen «deps»-commit om ønskelig. | Delvis revert av lock uten egen verifikasjon. |
| 5 | **Rot/tooling:** `tsconfig.json`, `vitest.config.ts`, `next.config.ts`, `playwright.config.ts`, `.eslintrc.cjs`, `.gitignore`, `.env.example`, `next-env.d.ts` | **KEEP IN BASELINE PATH NOW** | Én sammenhengende konfigurasjonsflate for TS/Next/test/lint/ignore; grønne gates på treet. | **Ja** inntil committet. | Commit som «tooling»-slice eller sammen med nære endringer. | Pick-and-choose per fil uten å forstå avhengigheter. |
| 6 | **`middleware.ts`** | **KEEP IN BASELINE PATH NOW** | Aktiv endring i autorisasjonskjede; gates PASS — inngår i videre baseline-arbeid (med ekstra review pga. `AGENTS.md` høyrisiko-fil). | **Ja** inntil committet. | Egen eller kombinert commit med eksplisitt review-sjekkliste. | «Tilfeldig» revert uten redirect-/gate-analyse. |
| 7 | **`plugins/coreBlocks.ts`** | **KEEP IN BASELINE PATH NOW** | CMS-blokkregister; linje med coreBlocks/ CMS-pipeline; grønt bygg. | **Ja** inntil committet. | Commit med CMS-scope. | Blande med urelaterte refaktorer. |
| 8 | **`scripts/**`** | **KEEP IN BASELINE PATH NOW** | Agents-ci, audit-api, sanity-live, diagnose, db-ci — støtter enterprise gates som nettopp passerte. | **Ja** inntil committet. | Commit. | Revert uten å kjøre hele gate-sekvensen etterpå. |
| 9 | **`studio/**`** | **KEEP IN BASELINE PATH NOW** | Mindre Sanity-studio-justeringer i samme gren. | **Ja** inntil committet. | Commit. | — |
| 10 | **`tailwind.config.cjs`** | **KEEP IN BASELINE PATH NOW** | Styling/bygg-konfig; del av samme leveranse. | **Ja** inntil committet. | Commit. | — |
| 11 | **`src/components/nav/HeaderShell.tsx` + `src/lib/guards/assertCompanyActiveApi.ts`** | **KEEP IN BASELINE PATH NOW** | Direkte kobling til **kanonisk header** og API-guard — sannsynlig kjernen i «rescue»-retningen som matcher `AGENTS.md` header-primitiver. | **Ja** inntil committet. | Commit tidlig i en «shell»-slice. | Revert uten å gjenopprette header-sannhet. |
| 12 | **Tracked `docs/**`-diff:** `docs/MEDIA_API_CONTRACT.md`, `docs/audit/U114_scoped_baseline_prep_record.md`, `docs/backoffice/HOME_NODE_BEHAVIOR.md` | **KEEP IN BASELINE PATH NOW** | Oppdatert kontrakt/audit/backoffice-notat; hører til dokumentasjons-sannhet (adskilt fra massiv untracked docs som allerede er committet). | **Ja** inntil committet. | Egen «docs»-commit eller sammen med relatert CMS-endring. | Blande inn **untracked** docs i samme commit uten egen pathspec-disiplin. |
| 13 | **`superadmin/system/repairs/run/route.ts` (slettet i diff)** | **HOLD OUTSIDE BASELINE NOW** | **Sletting** av rute under `superadmin/system`-området kolliderer med **frossen** superadmin system-fortelling inntil eier eksplisitt **låser opp** eller bekrefter at repair-endepunktet skal bort. Skal **ikke** behandles som «bare opprydding». | **Ja** — uavklart endring i **frosset** flate. | Eierbeslutning: gjenopprett route (**REVERT deletion** / restore) **eller** formell freeze-endring + erstatning; deretter egen minimal commit. | Merge til baseline uten eierstempel; anta at sletting er «trygg». |
| 14 | **`components/**` (alle 52 filer i diff under `components/`)** | **MUST SPLIT BEFORE DECISION** | Samme diff inneholder **minst tre ulike arter**: (i) brede **slettinger** (rot-marketing, `site/*`, `LoginForm`), (ii) **store** funksjonelle endringer (`toast`, `WeekMenuReadOnly`, `AppFooter`), (iii) **små** repetitive tweaks i admin/superadmin/…. Én disposition ville **skjule** om slettinger er bevisst konsolidering mot `HeaderShell` eller regressjon mot **S1 forside / innlogging** (frosset). | **Ja** — største **semantiske** risiko i treet. | Neste pakke: del opp i **underbøtter** (f.eks. «root marketing deletes», «site/auth deletes», «shell micro-edits», «toast/week/footer») og bind **per underbøtte** KEEP / REVERT / HOLD. | Commit hele `components/**` som én klump før split. |

**`REVERT TO HEAD`:** Ingen hel bøtte fikk **REVERT TO HEAD** i denne runden — ingen bøtte er ren «åpenbar feil» uten at gates samtidig er grønne; `REVERT` reserveres til eier når en **underbøtte** etter split er klassifisert som forkastet.

---

## Restliste etter disposisjon

1. **Untracked ~995** — ikke berørt (artifacts, supabase, archive, app/saas untracked, … avhengig av faktisk liste).  
2. **`components/**`:** **MUST SPLIT** — ingen endelig KEEP/REVERT/HOLD før underpakke.  
3. **`superadmin/system/repairs/...` sletting:** **HOLD** — krever eieravklaring mot freeze.  
4. Alle **KEEP**-bøtter (tests, e2e, workflows, deps, config, middleware, plugins, scripts, studio, tailwind, `src/...`, tracked docs): fortsatt **kun working tree** — baseline krever **commit** i apply-fase.

---

## Baseline status (single)

**BASELINE ER BEDRE, MEN FORTSATT BLOKKERT**

**Reason:** Gates er grønne på dirty tree, men **172 tracked filer** avviker fra `HEAD`, **~995 untracked** finnes fortsatt, **artifacts/** og **supabase/migrations/** er fortsatt HOLD, og **components/** + **superadmin repairs** har **ikke** endelig skjebne. Ingen «freeze» er ærlig.

---

## Exactly one next package

**Name:** `apply tracked diff disposition`  

**Why:** Disposisjonen er nå skriftlig; neste steg er **utførelse**: commits i **slicer** som respekterer KEEP-bøttene, **splitter `components/**`**, og **løser HOLD** på `superadmin/system/repairs` med eierinput før baseline.  

**Closes:** Flytter autorisert tracked sannhet inn i `git history` uten å blande inn HOLD-bøtter eller «én stor klump» for `components/**`.

---

## Sluttdom

Per nå er tracked dirty tree **overveiende KEEP IN BASELINE PATH NOW på test/CI/deps/config/middleware/CMS/scripts/studio/src-header/tracked docs**, med **`superadmin/system/repairs/...` → HOLD OUTSIDE BASELINE NOW** og **`components/**` → MUST SPLIT BEFORE DECISION**, og derfor er neste ærlige steg **`apply tracked diff disposition`**.

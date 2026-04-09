# Baseline recovery record — 2026-04-09

**Binding scope:** Kartlegging, klassifisering, minimale trygge grep (ignore + sletting av dokumentert regenererbare rotfiler). Ingen produktkode endret i denne pakken.

## Målt tilstand (etter måling)

| Måling | Verdi |
|--------|------|
| `git rev-parse HEAD` | `9c06d1cb3642ca52bd6520142811599299eacdd1` |
| Tracked arbeidskopi-endring (unstaged) | **172** filer (`git diff --name-only`) |
| Staged | **0** (`git diff --cached --name-only` tom) |
| Untracked (før grep) | **3170** (`git ls-files --others --exclude-standard`) |
| Untracked (etter sletting + nye ignore-regler) | **3162** (målt etter grep) |
| Diff-stat | 172 filer, +4297 / −3411 linjer |

### Untracked — toppnivå (antall filer)

Telt med PowerShell: første path-segment etter normalisering til `/`.

| Segment | Antall | Merknad |
|---------|--------|---------|
| docs | 1229 | Massiv parallel dokumentasjon utenfor indeks |
| lib | 939 | Massiv parallel kodebase utenfor indeks |
| artifacts | 315 | Bevis/screenshots (0 tracked i repo) |
| tests | 241 | Parallel test-masse utenfor indeks |
| components | 180 | Parallel komponent-masse utenfor indeks |
| supabase | 82 | Usporet migrering/policy-masse |
| scripts | 44 | Usporet |
| archive | 22 | Eksplisitt arkiv |
| e2e | 22 | Usporet |
| cua | 17 | Python-støtte (delvis ignorert i .gitignore) |
| src | 15 | Usporet |
| repo-intelligence | 13 | Analyse/rapport-mappe |
| app | 12 | bl.a. `app/product/`, `app/public/demo/`, `app/saas/` |
| audit | 6 | Verktøy/rapport |
| utils | 5 | Usporet |
| studio | 5 | Usporet |
| .cursor | 2 | Lokal IDE |
| øvrige rotfiler | (spredt) | Dockerfile, prompts, instrumentation.ts, design-system.md, config/, infra/, k8s/, workers/, m.m. |

### Tracked diff — grov inndeling (bevis fra `git diff --stat`)

- **Konfig / toolchain:** `.env.example`, `.eslintrc.cjs`, `.github/workflows/*`, `.gitignore`, `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `next.config.ts`, `tailwind.config.cjs`, `next-env.d.ts`, `plugins/coreBlocks.ts`, diverse `scripts/*`
- **Produkt / app:** `middleware.ts`, mange `components/**`, `src/components/nav/HeaderShell.tsx`, `src/lib/guards/assertCompanyActiveApi.ts`, `studio/**`
- **Tester / e2e:** svært mange `tests/**`, `e2e/**`
- **Dokumentasjon:** `docs/MEDIA_API_CONTRACT.md`, `docs/audit/U114_scoped_baseline_prep_record.md`, `docs/backoffice/HOME_NODE_BEHAVIOR.md`
- **Slettet i diff (eksempler):** eldre offentlige/marketing-komponenter, `components/auth/LoginForm.tsx`, `superadmin/system/repairs/run/route.ts`, m.fl.

**Bevis / ikke-bevis:** Tallene over beviser *masse og struktur*, ikke *intent*. Volum ≠ ferdig produkt.

## Gates (kjørt på dirty tree — 2026-04-09)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (kun advarsler, exit 0) |
| `npm run test:run` | PASS — 359 testfiler pass, 4 skipped; 1599 tester pass, 13 skipped |
| `npm run build:enterprise` | PASS (exit 0, inkl. SEO-steg) |

`sanity:live` ble **ikke** kjørt (ikke i påkrevd liste for denne pakken).

## Baseline-bunker (KEEP / IGNORE / DELETE / OWNER DECISION)

### Indexed truth (HEAD + eventuelt fremtidige commits)

| Bøtte | Tracked | Klassifisering | Hvorfor |
|-------|---------|----------------|---------|
| `app/` (indeksert) | 1181 filer i indeks | **KEEP** | Kanonisk applikasjon i git |
| `lib/` (indeksert) | 1187 filer | **KEEP** | Kanonisk delt logikk i git |
| `components/` (indeksert) | 121 filer | **KEEP** | Kanonisk UI i git |
| `tests/` (indeksert) | 135 filer | **KEEP** | Kanonisk testbase i git |
| `e2e/` (indeksert) | 22 filer | **KEEP** | Kanonisk e2e i git |
| `supabase/` (indeksert) | 73 filer | **KEEP** | Kanonisk DB-kontrakt i git |
| `studio/` (indeksert) | 38 filer | **KEEP** | Kanonisk CMS-schema i git |
| `docs/` (indeksert) | 131 filer | **KEEP** | Dokumentasjon under versjonkontroll |
| `scripts/` (indeksert) | 36 filer | **KEEP** | Bygg/CI/audit-skript i git |
| `workers/` | 0 i indeks | **OWNER DECISION** | Usporet `workers/` finnes (1 fil i untracked telling) — skal den inn i repo eller ignoreres? |
| `archive/` | 0 i indeks | **OWNER DECISION** | 22 untracked filer — bevisst arkiv vs utilsiktet kopi? |
| `artifacts/` | 0 i indeks | **OWNER DECISION** | 315 untracked — bevisbank vs støy; policy for ignore eller kuratert commit |

### 172-filers tracked diff (arbeidskopi vs HEAD)

| Bøtte | Tracked | Klassifisering | Hvorfor |
|-------|---------|----------------|---------|
| Hele diff-massen | Endret vs HEAD | **OWNER DECISION** | Spenner middleware, header, studio, tester, workflows — kan ikke revisjonssikres som én blanding; må splittes, forkastes eller committes med eksplisitt strategi. Blokkerer ren baseline uansett. |

### Untracked parallel-trær (største volum)

| Bøtte | Untracked | Klassifisering | Hvorfor |
|-------|-----------|----------------|---------|
| `docs/` (utover indeks) | ~1229 | **OWNER DECISION** | Kan være ekte dokumentasjonsarbeid eller duplikat — må avgjøres mot indeksert `docs/` |
| `lib/` (utover indeks) | ~939 | **OWNER DECISION** | Indikerer parallel kodebase eller eksport — høy risiko for duplikat/ drift fra sannhet |
| `tests/` | ~241 | **OWNER DECISION** | Samme som over |
| `components/` | ~180 | **OWNER DECISION** | Samme som over |
| `supabase/` | ~82 | **OWNER DECISION** | Migreringer må aldri «gjettes» inn — eier må bekrefte |
| `app/product/`, `app/public/`, `app/saas/` | del av ~12 app | **OWNER DECISION** | Produktstier — ikke klassifisert som støy uten eier |
| `.cursor/` | 2 | **IGNORE** (etter denne pakken) | Lokalt; skal ikke være repo-sannhet |
| `cua/` (venv, cache, …) | del av 17 | **IGNORE** | Allerede dekket av mønstre i `.gitignore` (Python/cua) |
| `*.log` (rot) | dekket | **IGNORE** | `*.log` i `.gitignore` |
| Regenererbare rot-dumps | var untracked | **DELETE** (utført) | `full_audit.txt`, `fullAudit.json`, `dead-files.json`, `prioritizedTasks.json`, `structure.txt` — lokale inventory/audit outputs |

### Rotfiler / meta (untracked, ikke full liste)

| Bøtte | Klassifisering | Hvorfor |
|-------|----------------|---------|
| `CURSOR_*PROMPT*.md`, `REPO_DEEP_DIVE_REPORT.md`, `audit-v4.cjs`, `Dockerfile`, `.dockerignore`, `.github/workflows/auto-engineer.yml`, `policy-merge.yml`, `instrumentation.ts`, `design-system.md`, `config/`, `infra/`, `k8s/`, `repo-intelligence/` | **OWNER DECISION** | Kan være legit deploy/verktøy eller engangsnotat — ingen automatisk sletting |

## Hva som faktisk ble endret (denne pakken)

1. **Slettet (untracked, regenererbare dumps):** `full_audit.txt`, `fullAudit.json`, `dead-files.json`, `prioritizedTasks.json`, `structure.txt` (begrunnelse: store/strukturerte lokale audit-/inventory-filer, ikke indeksert sannhet).
2. **`.gitignore` (arbeidskopi):** lagt til `.cursor/` og eksplisitte filnavn for regenererbare dumps (se over). **Merk:** `.gitignore` hadde allerede annet uløst WIP i arbeidskopi; denne endringen er **ikke** isolert committet her — se nedenfor.
3. **Ikke rørt:** `app/**`, `lib/**`, `components/**`, `tests/**`, `e2e/**`, `supabase/**`, `studio/**`, `artifacts/**` innhold (bortsett fra slettede rotfiler), øvrig produktkode.
4. **Commit:** Kun `docs/audit/BASELINE_RECOVERY_2026-04-09.md` skal stages committes som smal baseline-record (hvis eier kjører commit). `.gitignore` stages **ikke** i denne pakken pga. blandet eksisterende WIP.

## Baseline-status (én)

**BASELINE ER BEDRE, MEN FORTSATT BLOKKERT**

**Begrunnelse:** Én ren revisjonerbar tilstand krever at (a) arbeidskopi matcher en eksplisitt commit eller at diff er null, og (b) untracked ikke dominerer `git status`. Her er **3162 untracked** filer (målt) og **172 tracked** endringer — begge deler blokkerer auditérbar historikk. Gates på dirty tree passerer, men det beviser ikke revisjonssikkerhet.

## Neste pakke (én)

**Navn:** Eierbeslutning og plan for **hele untracked-treet** (prioritet: `docs/`, `lib/`, `components/`, `tests/`, `supabase/`, deretter `artifacts/` og rot-meta).

**Hvorfor:** Største tallmessige og operasjonelle blokkering for lesbar `git status` og for kloner som skal reprodusere sannhet.

**Hva den lukker:** Enten (1) kuratert innlemming i indeks med klare commits, (2) bevisst sletting av duplikat/eksport, eller (3) dokumentert ignore-policy per rot — slik at untracked ikke lenger utgjør «usynlig halv-repo».

## Sluttdom

Per nå er baseline **ikke revisjonssikker** (dirty index + tusenvis av untracked), og neste ærlige steg er **eierstyrt klassifisering og disposisjon av untracked-massen** før noen «freeze»-erklæring kan forsvares.

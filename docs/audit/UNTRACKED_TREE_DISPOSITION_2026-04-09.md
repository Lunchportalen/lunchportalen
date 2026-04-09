# UNTRACKED TREE DISPOSITION — 2026-04-09

**Scope:** Bindende kartlegging og firesortering av hele untracked-treet. Ingen produktkode endret. Ingen bulk-sletting av potensielt ekte arbeid.

## Målinger (fersk)

| Måling | Verdi |
|--------|--------|
| `git rev-parse HEAD` | `8fa5dd238d8ba7727e38b5c3d97475eb77611f76` |
| Untracked filer (`git ls-files --others --exclude-standard`) | **3162** |
| `git status --short` linjer (default, kataloger kollapset) | **805** (`??` rader **633**) |
| `git status --short -uall` `??` rader | **3162** (matcher `ls-files`) |
| Arbeidstre vs HEAD (`git diff --stat`) | **172 filer** endret, +4306 / −3411 linjer |
| Staged (`git diff --cached --name-only`) | *(tom)* |

## Gates kjørt (denne økta)

| Kommando | Resultat |
|----------|----------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (advarsler, exit 0) |
| `npm run test:run` | PASS (359 filer kjørt, 4 skipped) |
| `npm run build:enterprise` | PASS (SEO-PROOF / SEO-AUDIT / SEO-CONTENT-LINT OK) |
| `npm run sanity:live` | **FAIL** — `fetch failed` mot `http://localhost:3000` (ingen kjørende app / ingen base-URL i env) |

## Toppnivå untracked (antall filer)

Gruppert med PowerShell på første path-segment:

| Toppnivå | Antall |
|----------|--------|
| docs | 1229 |
| lib | 939 |
| artifacts | 315 |
| tests | 241 |
| components | 180 |
| supabase | 82 |
| scripts | 44 |
| e2e | 22 |
| archive | 22 |
| cua | 17 |
| src | 15 |
| repo-intelligence | 12 |
| app | 12 |
| audit (rot, ikke docs/audit) | 6 |
| utils | 5 |
| studio | 5 |
| infra | 2 |
| .github | 2 |
| k8s | 2 |
| workers | 1 |
| Rotfiler (Dockerfile, .dockerignore, prompts, rapporter, m.m.) | 8 |

## Andre nivå — store underbøtter (utdrag)

| Path-gruppe | Antall |
|-------------|--------|
| docs/umbraco-parity | 652 |
| docs/cms-control-plane | 130 |
| tests/cms | 122 |
| docs/umbraco-migration | 105 |
| supabase/migrations | 82 |
| lib/social | 74 |
| docs/audit (under docs/) | 70 |
| components/blocks | 65 |
| lib/sales | 60 |
| lib/growth | 57 |
| components/cms | 47 |
| lib/revenue | 45 |
| docs/repo-audit | 40 |
| lib/autonomy | 38 |
| tests/ai | 35 |
| artifacts/* (mange uXX-bevismapper, PNG/JSON) | 315 totalt |
| app/saas | 6 |
| app/public | 5 |
| app/product | 1 |

## Trygge DELETE/IGNORE-kandidater (grep)

- Søk etter untracked som matcher åpenbar `*.log`, `tmp/`, `__pycache__`, `.pyc`: **0 treff**.
- Tidligere mønster som traff `lib/cache/*.ts` er **kildefiler**, ikke cache — **ikke** slettet.
- **Utført sletting:** ingen.
- **Utført .gitignore-utvidelse:** ingen (krever eierpolicy før f.eks. `artifacts/` kan ignoreres uten å skjule bevis som skal revisjoneres).

## Firesortering (bindende for denne pakken)

Alle grupper nedenfor er **untracked** med mindre annet er sagt. «Blokkerer baseline» = gjør `git status` uærlig / uhandterbar for fryse og/eller skjuler ikke revisjonerbar sannhet.

| Path-gruppe | Disposisjon | Hvorfor | Baseline-blokkering |
|-------------|-------------|---------|---------------------|
| **docs/** (inkl. umbraco-parity, cms-control-plane, phase2*, audit under docs/, …) | **OWNER DECISION** | Stor dokumentasjons- og sporingsmasse; heterogen verdi; kan ikke bulk-gjettes som støy. | Ja — volum + uklar revisjonsstrategi |
| **lib/** (social, sales, growth, ml, …) | **OWNER DECISION** | Ser ut som parallell/eksperimentell kodebase, ikke åpenbart generert. | Ja — potensielt ekte arbeid eller farlig duplikat |
| **artifacts/** (u8x/u9x PNG, json, boot logs) | **OWNER DECISION** | Bevis/artefakter; kan være regenererbare eller krav til sporbarhet — policy må bestemmes. | Ja — stort binært fotavtrykk untracked |
| **tests/** (untracked) | **OWNER DECISION** | Kan være duplikat, utkast eller fremtidige tester — krever sammenligning med tracked suite. | Ja |
| **components/** (untracked) | **OWNER DECISION** | Parallell UI — risiko for shadow/duplikat av tracked komponenter. | Ja |
| **supabase/** (82 filer, dont **migrations**) | **OWNER DECISION** | Migrasjoner er system-sannhet; må eies eksplisitt (track vs forkast). | Ja — høy risiko |
| **scripts/** | **OWNER DECISION** | Verktøy/CI-støtte — kan være nødvendig eller kladde. | Middels |
| **e2e/** | **OWNER DECISION** | Test-infrastruktur — avhenger av strategi. | Middels |
| **archive/** | **OWNER DECISION** | Navnet antyder bevisst arkiv; commit vs slette vs flytte er eiers valg. | Lav–middels |
| **cua/** | **OWNER DECISION** | Python-støtte; .gitignore dekker allerede typisk Python-støy — tracked scope uavklart. | Lav |
| **src/** (untracked) | **OWNER DECISION** | Overlapp med eksisterende `src/` mulig. | Middels |
| **repo-intelligence/** | **OWNER DECISION** | Meta / maskinlesbar innsikt — ofte ikke produksjonssannhet; krever policy. | Lav–middels |
| **app/** (untracked, saas/public/demo/product) | **OWNER DECISION** | App-ruter — høy innvirkning; ingen auto-KEEP uten review. | Ja |
| **audit/** (rot: `audit/forensic-2026-04-05/*`) | **OWNER DECISION** | Forensikk/ledger — revisjonsverdi vs støy avgjøres av eier. | Middels |
| **utils/**, **studio/** (untracked deler), **infra/**, **k8s/**, **.github/** (untracked), **workers/** | **OWNER DECISION** | Infra/CI/deploy — må mappes til faktisk bruk. | Varierer |
| **Rotfiler** (Dockerfile, .dockerignore, CURSOR_*.md, REPO_DEEP_DIVE_REPORT.md, design-system.md, instrumentation.ts, audit-v4.cjs, **config/**) | **OWNER DECISION** | Mix av deploy, prompts og meta — ingen sikker bulk-DELETE/IGNORE. | Middels |

**DELETE (utført):** ingen kandidater som var åpenbart generert/log/tmp blant untracked.

**IGNORE (utført):** ingen nye mønstre lagt inn — unngår å skjule bevis eller produkt uten bindende policy.

**KEEP (eksplisitt):** ikke tildelt automatisk; eier må velge per bøtte hva som skal inn i revisjon.

## Restliste som krever eier (kort prioritert)

1. **supabase/migrations** (82) — database-sannhet.
2. **docs/** — særlig `docs/umbraco-parity` (652) og `docs/cms-control-plane` (130): arkivere, tracke delsett, eller fjerne utenfor git.
3. **lib/** (939) — intendert modulær arkitektur vs kladde; eventuell sammenslåing med tracked `lib/`.
4. **artifacts/** (315) — LFS, separat lager, .gitignore, eller kuratert commit.
5. **tests/** + **components/** + **app/** untracked — merge, slett duplikater, eller egne commits etter review.

## Baseline-status (én setning)

**BASELINE ER BEDRE, MEN FORTSATT BLOKKERT** — untracked er nå telt, gruppert og firesortert, men **3162 filer** er fortsatt utenfor revisjon, **172 tracked filer** er endret mot HEAD, og **sanity:live** ble ikke grønn i dette miljøet (localhost).

## Neste pakke (én)

**Navn:** Eierbeslutning: untracked «sannhets»-bøtter (supabase/migrations + docs-policy + artifacts-policy)

**Hvorfor:** Største restblokkering etter denne kartleggingen er ikke «ukjent masse», men **ubestemt skjebne** for migrasjoner, dokumentasjonsvolum og bevisfiler.

**Hva den lukker:** Bindende KEEP/IGNORE/DELETE per prioritering over migrasjoner og de tre største volumbøttene (docs, lib, artifacts), slik at `git status` kan nærme seg revisjonerbar baseline.

## Endringer i repo (denne pakken)

- Ny fil: `docs/audit/UNTRACKED_TREE_DISPOSITION_2026-04-09.md` (dette dokumentet).
- Ingen andre filer endret; ingen commit utført av denne pakken.

# U111 — Owner scope: gjenværende WIP + untracked (canonical record)

**Dato:** 2026-04-09  
**HEAD:** `72346ecdeb2b26efbfae27caac56928623896f13`  
**Status:** Dette er **ikke** baseline-bevis. Dette er **ikke** proof. Kun kartlegging + bindende eierliste + anbefalt rekkefølge.

---

## 1) Målinger (faktiske kommandoer)

| Kilde | Resultat |
|--------|-----------|
| `git rev-parse HEAD` | `72346ecdeb2b26efbfae27caac56928623896f13` |
| `git ls-files --others --exclude-standard` | **4369** paths |
| `git diff --name-only` | **823** paths |
| `git diff --stat` | **823 files changed**, **18050 insertions**, **19599 deletions** |
| `git diff --cached --name-only` | *(tom — ingenting staged)* |
| `npm run typecheck` | **PASS** (exit 0) |
| `npm run test:run` | **PASS** — 359 testfiler pass, 4 skipped; 1599 tester pass, 13 skipped |

**Hva dette beviser / ikke beviser**

- Beviser: arbeidskopien **typechecker** og **enhetstester** kjører grønt på nåværende filsett.  
- Beviser **ikke**: ren git-baseline, at alt i WIP/untracked er produkt-sannhet, eller at RC-scope er avgrenset.

**Merknad `git status --short`:** Linjer med `??` var **1506** i første kjøring; `git ls-files --others --exclude-standard` rapporterer **4369** filer (revalidert samme dag) — **ikke bland disse** uten forklaring: kort status kan aggregere/underkommunisere full filflate vs. full untracked-liste.

**`find … -maxdepth 4` (bash, repo-rot):** antall filer per rot — `app` 603, `lib` 2126, `components` 287, `tests` 376, `e2e` 44, `docs` 1345, `supabase` 164, `scripts` 80, `workers` 1. *(Teller kun ned til dybde 4 fra hver rot; dypere filer inkluderes ikke.)*

---

## 2) Untracked — toppnivå (første path-segment)

Fra `git ls-files --others --exclude-standard`, gruppert på rot:

| Segment | Antall |
|---------|--------|
| `lib` | 1582 |
| `docs` | 1217 |
| `app` | 581 |
| `artifacts` | 313 |
| `tests` | 241 |
| `components` | 180 |
| `supabase` | 82 |
| `scripts` | 44 |
| `e2e` | 22 |
| `archive` | 22 |
| `cua` | 17 |
| `src` | 15 |
| `repo-intelligence` | 13 |
| `audit` | 6 |
| `utils` | 5 |
| `studio` | 5 |
| + spredt rot (`.github`, `.cursor`, `k8s`, `infra`, rapporter, json, Dockerfile, m.m.) | lav |

**Tyngdepunkt:** Untracked er **dominert av `lib/` og `docs/`**, deretter `app/`, `artifacts/`, `tests/`, `components/`.

---

## 3) Tracked WIP (working tree diff) — toppnivå

Fra `git diff --name-only`, gruppert på rot:

| Segment | Antall |
|---------|--------|
| `lib` | 383 |
| `app` | 269 |
| `tests` | 74 |
| `components` | 61 |
| `scripts` | 7 |
| `studio` | 4 |
| `.github` | 4 |
| `e2e` | 3 |
| `src` | 2 |
| `docs` | 2 |
| + rotfiler (`package.json`, `tsconfig.json`, `middleware.ts`, `vitest.config.ts`, `playwright.config.ts`, `next.config.ts`, `.gitignore`, `.env.example`, `.eslintrc.cjs`, `tailwind.config.cjs`, `next-env.d.ts`, `plugins/`, `superadmin/`) | lav |

**Tyngdepunkt:** Tracked diff er **dominert av `lib/` + `app/`**, med betydelig test- og component-følge.

---

## 4) Typiske under-cluster (utdrag — for eierlesning)

**Untracked `lib/` (andre nivå, topp):** `ai` (421), `cms`, `social`, `sales`, `growth`, `revenue`, `autonomy`, `ads`, `ml`, `outbound`, `observability`, … — **ser ut som parallel(e) produkt-/plattformlinje(r)**, ikke én liten patch.

**Untracked `docs/` (andre nivå, topp):** `umbraco-parity` (652), `cms-control-plane`, `umbraco-migration`, `audit`, `repo-audit`, `phase2*`, `hardening`, … — **ser ut som migrasjons-/kontrollplan-pakker**, adskilt fra små RC-tekstfikser.

**Untracked `app/` (andre nivå, topp):** `api` (260), `(backoffice)` (256), `superadmin`, … — **APIflate + backoffice** tungt representert.

**Tracked diff `app/` (andre nivå):** `api`, `(backoffice)`, `superadmin`, `admin`, … — **samme stormsentre som untracked**, dvs. **blanding av etablert WIP og ny parallellflate**.

---

## 5) Filflate-prøve (`find <rot> -maxdepth 4 -type f`, bash)

| Rot | Antall filer |
|-----|----------------|
| `app` | 603 |
| `lib` | 2126 |
| `components` | 287 |
| `tests` | 376 |
| `e2e` | 44 |
| `docs` | 1345 |
| `supabase` | 164 |
| `scripts` | 80 |
| `workers` | 1 |

---

## 6) Hovedbøtter + klassifisering (streng)

| Hovedbøtte | Dominerende type | Vurdering (kort) | Status |
|------------|------------------|------------------|--------|
| **`app/**`** | **Blandet** (stor untracked + stor tracked diff) | Backoffice/content + API preget; ser ut som **ekte arbeid** og **mulig parallell struktur** | **KREVER EIERAVGJØRELSE** |
| **`lib/**`** | **Blandet**, **untracked-dominerende** | Mange navnerom (`ai`, `growth`, `sales`, …) — **egen emnelinje** / plattformlag | **KREVER EIERAVGJØRELSE** |
| **`components/**`** | **Blandet** | Følger sannsynligvis app/lib-scope | **KREVER EIERAVGJØRELSE** |
| **`tests/**`** | **Blandet** | Stor flate; **koblet til WIP** — ikke automatisk «baseline» | **KREVER EIERAVGJØRELSE** |
| **`e2e/**`** | **Liten blandet** | Få filer vs. totalmasse; fortsatt scope-spørsmål | **KREVER EIERAVGJØRELSE** |
| **`docs/**` *utenfor* bevisst audit-spor** | **Untracked-dominerende** | Paritet/migrasjon/faser — **tydelig eget emne** | **SANNSYNLIG IKKE BASELINE** *(med mindre eier eksplisitt løfter inn)* |
| **`docs/audit/**` (formelle poster som denne)** | Bevisst vedlikehold | Del av sporbarhet | **KEEP-CANDIDATE** |
| **`supabase/**`** | **Untracked tung** | Skjema/migrasjoner — **kritisk for sannhet** | **KREVER EIERAVGJØRELSE** |
| **`scripts/**`** | **Untracked + diff** | Verktøy/CI-støtte — avhenger av baseline-valg | **KREVER EIERAVGJØRELSE** |
| **`workers/**`** | **Minimal** (1 untracked observert) | Isolert — **for lite til dom alene** | **FOR UKLAR TIL Å TA NÅ** *(knyttes til job/outbox/infra-beslutning)* |
| **Rot / infra / repo-støy** (`artifacts/`, `archive/`, `cua/`, `repo-intelligence/`, `.cursor/`, genererte json/txt, store prompt-/rapportfiler, Dockerfile, workflows, `middleware.ts`, `package*.json`, `tsconfig`, testrunner-config) | **Blandet** | Dels **generert/ad hoc**, dels **gate-kritiske** konfigfiler | **Delvis SANNSYNLIG IKKE BASELINE** *(artifacts, archive, ad hoc rapporter, .cursor-pakker)* + **KREVER EIERAVGJØRELSE** *(middleware, CI, package/tsconfig, låste løp)* |

---

## 7) Bindende eierbeslutninger (konkrete JA/NEI)

1. **Beslutning:** Skal hele den **untracked `lib/**`-treet** (inkl. `lib/ai`, `lib/sales`, `lib/growth`, …) være **del av RC/baseline-produktet**, eller **karantene** (eget repo, branch, eller sletting etter arkivering)?  
   - **Paths:** `lib/**` (untracked + tilhørende diff)  
   - **Hvis JA:** Baseline-arbeid må inkludere eksplisitt **eierskap per under-namespace** og integrasjon mot `app/`/`components/`.  
   - **Hvis NEI:** Alt under disse navnerommene behandles som **ikke-baseline** til det er fjernet/arkivert/utskilt; `app/api` og `components` som kun tjener dette må følge samme dom.

2. **Beslutning:** Skal **untracked `app/api/**` + backoffice-flate** (jfr. ~260 + ~256 untracked filer på andre nivå) være **én leveranse** inn i RC, eller **holdes utenfor** til migrasjon er ferdig definert?  
   - **Paths:** `app/api/**`, `app/(backoffice)/**` (untracked + diff)  
   - **Hvis JA:** Eier må definere **minimum RC-slice** (hvilke ruter/sider som er «inn»).  
   - **Hvis NEI:** Ingen baseline- eller proof-pakke kan anta denne flaten som sannhet; må **ignoreres eller utskilles** før baseline.

3. **Beslutning:** Skal **`docs/umbraco-parity/**`, `docs/cms-control-plane/**`, `docs/umbraco-migration/**` og beslektet `docs/phase2*`** behandles som **produkt/leveranse** eller som **ikke-baseline dokumentasjon** (arkiv / egen pakke)?  
   - **Paths:** `docs/umbraco-parity/**`, `docs/cms-control-plane/**`, `docs/umbraco-migration/**`, `docs/phase2*/**`, beslektet `docs/repo-audit/**`  
   - **Hvis JA:** Eier må knytte dem til **konkrete milepæler** og **hva som er «done»**.  
   - **Hvis NEI:** Hold utenfor baseline-arbeid; evt. **én egen «docs split»-pakke** senere.

4. **Beslutning:** Skal **`artifacts/**`, `archive/**`, `cua/**`, `repo-intelligence/**`, rot-`*.json` / `full_audit.txt` / prompt-masterfiler** være **i samme repo** som baseline, eller **`.gitignore` / flyttet / slettet** etter arkivering?  
   - **Paths:** `artifacts/**`, `archive/**`, `cua/**`, `repo-intelligence/**`, `fullAudit.json`, `full_audit.txt`, `prioritizedTasks.json`, `dead-files.json`, `CURSOR_MASTER_PROMPT_*`, `CURSOR_PHASED_PROMPTS_*`, `REPO_DEEP_DIVE_REPORT.md`, m.fl.  
   - **Hvis JA:** Eier definerer **hvor** de lever (kun lokal / egen gren / eget lager).  
   - **Hvis NEI:** De **blokkere ikke** baseline-definisjon; fjernes fra «sannhets»-flaten.

5. **Beslutning:** Skal **untracked `supabase/**`** (82 filer observert) **inn i baseline** som migrasjons-sannhet, eller **holdes utenfor** til egen DB-pakke?  
   - **Paths:** `supabase/**`  
   - **Hvis JA:** Krever **eksplisitt migrasjonsplan** og **miljø-sannhet**.  
   - **Hvis NEI:** Baseline antar **eksisterende committed schema**; nytt arbeid **karantenes**.

6. **Beslutning:** For **`tests/**` og `e2e/**`**: Hvilke mapper/filer er **RC-kritiske** vs. **eksperiment-/CMS-migrasjon**?  
   - **Paths:** `tests/**`, `e2e/**` (untracked + diff)  
   - **Hvis JA (full inkludering):** Testene blir **del av baseline-kontrakten**.  
   - **Hvis NEI (delt):** Eier må publisere en **liste over «baseline test roots»**; resten **karantenes** eller **skilles ut**.

7. **Beslutning:** Skal **rot-konfig** med sikkerhets-/gate-effekt (`middleware.ts`, `.github/workflows/*.yml`, `package.json` / låser, `tsconfig.json`, `vitest.config.ts`) endres **kun i dedikerte små pakker** etter scope-valg, eller fortsette **i samme WIP-bøtte** som CMS?  
   - **Paths:** `middleware.ts`, `.github/workflows/**`, `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `next.config.ts`  
   - **Hvis JA (isolerte pakker):** Reduserer risiko for **låste løp**-regresjon.  
   - **Hvis NEI:** **Høy regressjonsrisiko** — fortsatt lov, men da er **eier ansvarlig** for blast radius.

---

## 8) Anbefalt split-sekvens (ikke utført her)

1. **Først:** Eier tar beslutning **punkt 1–2** (`lib/**` + `app/api` + `(backoffice)` untracked/diff) — dette er **største usikkerhet** og **kobler** `components/` + `tests/`.  
2. **Deretter:** Eier tar beslutning **punkt 3–4** (store `docs/`-pakker + `artifacts`/archive/ad hoc) — **lav produktrisiko**, høy **kognitiv rydding**.  
3. **Så:** **Supabase + workers/outbox** (punkt 5 + `workers/**` i infrabeslutning) — **data-sannhet**.  
4. **Til slutt:** Eksplisitt **test/e2e baseline-liste** (punkt 6) og **isolasjon av config/gate** (punkt 7).

**Hold utenfor baseline-arbeid inntil eier:** `docs/umbraco-*`, `docs/phase2*`, `artifacts/`, `archive/`, ad hoc rot-rapporter — med mindre eier løfter dem inn.

---

## 9) Én neste pakke (U112 — anbefalt)

**Navn:** **U112 — Eierbinding: untracked `lib/**`-tre + kobling mot `app/api` og `app/(backoffice)`**

**Hvorfor:** Største **untracked**-masse og tydelig **navneroms-fork**; alt annet (tests, components, docs) **følger** denne dommen.

**Hva den lukker:** Enten (a) **skriftlig INN** med **navneromsliste og RC-slice**, eller (b) **skriftlig UT** med **karantene-/arkivplan** og **hvilke imports/ruter som dør** — slik at baseline ikke lenger er **åpen flate**.

---

## 10) Sluttdom (én setning)

**Per nå er gjenværende WIP-scope en blandet, tusen-filers flate dominert av untracked `lib/` + `docs/` og tracked diff i `lib/` + `app/`, og derfor er neste ærlige steg en eierbinding på untracked `lib/**` og tilhørende `app/api` / `(backoffice)`-flate (U112), ikke mer «bygging i blinde».**

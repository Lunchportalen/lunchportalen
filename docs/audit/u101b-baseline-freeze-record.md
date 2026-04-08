# U101B — Canonical baseline record (freeze truth)

**Dato:** 2026-04-08  
**Formål:** Én bindende baseline-sannhet for audit/proof-kjede. Ingen produktendringer i denne pakken utover dette dokumentet og minimal krysreferanse.

**Policy:** `docs/audit/policies/audit-baseline-policy.md` — *Dirty tree = ingen audit-baseline.*

---

## A) Kommandoer kjørt (faktiske resultater)

| Kommando | Resultat |
|----------|----------|
| `git rev-parse HEAD` | `a809362e296b80459c1adc2ae5932aeb1cb9b82f` |
| `git status --short` (standard) | **2338** linjer |
| `git status --porcelain -uall` | **5203** linjer (full utlisting av untracked) |
| `git ls-files --others --exclude-standard` | **4373** paths (ubevoktet arbeidskopie) |
| `git diff --stat` (working tree vs index) | **825** filer endret, **+18050** / **-21118** linjer |
| `git diff --cached --stat` | **8** filer staged (**+4959** / **-8296** linjer i den stat-output som ble observert) |
| `find . -maxdepth 3` (`*.log` / `*.tmp` / `*.cache`) | Treff inkl. rot-logger (`dev-smoke.*.log`, `_proof_*.log`), `artifacts/**/*.log`, `docs/evidence/*.log`, katalogen `./.tmp` — **ikke** en full rotårsaksliste for dirty tree; mest relevant for hygiene/artefakt-støy |
| `npm run typecheck` | **PASS** (exit 0) |
| `npm run test:run` | **PASS** — 359 testfiler passert, 4 skipped; 1599 tester passert, 13 skipped (kjøretid ~73 s) |

**Hva dette beviser / ikke beviser**

- **Beviser:** På denne maskinen, med **nåværende** arbeidskopie (dirty), kjører `typecheck` og `test:run` grønt.
- **Beviser ikke:** At **HEAD alene** er reproduserbar audit-baseline, at CI/release-proof kan bindes til arbeidskopien, eller at E4/100 %-påstander holder — per policy kreves **ren tree** for audit-baseline.

---

## B) Oppsummert tilstand (brutalt)

| Begrep | Verdi |
|--------|--------|
| **Siste commit (HEAD)** | `a809362e296b80459c1adc2ae5932aeb1cb9b82f` |
| **Ren working tree?** | **Nei** |
| **Audit-baseline gyldig etter policy?** | **Nei** (*dirty tree diskvalifiserer*) |
| **Hovedproblem** | Massiv, blandet WIP: tusenvis av ubevoktede filer, hundrevis av endrede sporade filer, **og** delvis **staged** endringer (se nedenfor). |

---

## C) Dirty tree inventory (gruppert)

Tellinger fra `git status --porcelain` med path-prefiks (én linje kan være staged+modified `MM`; tall er **indikator**, ikke formell diff-stat):

| Kategori | Ca. antall status-linjer (prefiks-match) | Innhold (kort) |
|----------|------------------------------------------|----------------|
| **Produktkode** (`app/`) | **677** | Bred dekning: auth, admin, API, backoffice/CMS, public, m.m.; slettinger og modifikasjoner |
| **Produktkode** (`lib/`) | **991** | Stor flate endringer |
| **Produktkode** (`components/`) | **94** | Diverse UI |
| **Tester** (`tests/`) | **292** | Mange testfiler berørt |
| **e2e** (`e2e/`) | **25** | Playwrightflate |
| **docs/audit** | **54** | Audit-dokumenter endret (inkl. store full-system logger) |
| **artifacts/** | **1** | Minimal status-linje mot denne stien |
| **Konfig / tooling** (rot + `.github`, `package.json`, `tsconfig`, `vitest`, eslint, `.gitignore`, `.env.example`, m.m.) | Inngår i resten av **829** «ikke-??»-linjer i standard `porcelain` | Workflows og bygg/test-konfig endret |
| **Ubevoktet (untracked)** | **4373** filer (`git ls-files --others --exclude-standard`) | Nye og dupliserte spor under bl.a. `app/` (mange nye ruter/komponenter), `.cursor/`, rot-filer (`Dockerfile`, `CURSOR_*.md`, `typecheck-out.txt`, …) — **ikke** «kun støy»; det er **ekte** filer som ikke er i index |

**Staged (index) — eksakt liste (`git diff --cached --name-only`):**

1. `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx`
2. `app/(backoffice)/backoffice/content/_components/contentWorkspace.aiRequests.ts`
3. `app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks.ts`
4. `app/(backoffice)/backoffice/content/_components/contentWorkspace.outbox.ts`
5. `app/(backoffice)/backoffice/content/_components/contentWorkspacePageEditorShellInput.ts`
6. `app/(backoffice)/backoffice/content/_components/forsideUtils.ts`
7. `docs/audit/full-system/IMPLEMENTATION_LOG.md`
8. `docs/audit/full-system/POST_IMPLEMENTATION_REVIEW.md`

**Støy vs. blockers**

- **Line-ending-advarsler** (LF/CRLF) fra `git diff` er **støy i forhold til rot**, men **ikke** hovedproblemet.
- **Blockers for audit-baseline:** (1) **829** linjer med tracked endringer (ikke-??) i porcelain, (2) **4373** untracked filer, (3) **825** filer med unstaged diff, (4) **8** staged filer som blander **CMS/backoffice-produktkode** med **store audit-logger** — *kan ikke* kalles «entydig baseline» uten eierbeslutning (commit/stash/reset/branch).

---

## D) Baseline-valg (entydig)

**Valg: *Baseline kan ikke fryses ærlig i denne pakken* — egen rydde-/konsolideringspakke kreves.**

**Begrunnelse (kort, brutal):**

- Policy sier uttrykkelig: **ren `git status`** for det som inngår i påstanden; **dirty tree = ingen audit-baseline.**
- Arbeidskopien er **ikke** «litt støy»: den har **tusenvis** av ubevoktede filer og **hundrevis** av endrede spor, pluss **staged** endringer som blander produkt og dokumentasjon.
- **HEAD** `a809362e296b80459c1adc2ae5932aeb1cb9b82f` er den **siste committete** tilstanden og den **eneste** SHA som kan refereres uten tvil om *hva Git allerede har lagret* — men den er **ikke** «gyldig audit-baseline for arbeidskopien» så lenge treet er dirty.
- En «ny commit» fra dagens tilstand ville være en **massiv** eierbeslutning (ikke en «minimal baseline-grep») og hører ikke hjemme i U101B.

---

## E) Gyldighet mot senere proof (eksplisitt)

| Bruk | Gyldig nå? | Merknad |
|------|------------|---------|
| **Lokal audit** (reproduserbar mot *én* definert tilstand) | **Nei** | Krever ren tree eller eksplisitt avtalt scope utelukkende til HEAD uten lokale endringer |
| **CI proof** | **Nei** | Arbeidskopien matcher ikke én entydig commit; push/PR vil ikke reflektere denne tilstanden uten commit |
| **Release proof** | **Nei** | Samme; dessuten krever policy tag/release-branch eller artifacts med innebygd SHA fra bygget |

**Hva som fortsatt blokkerer full baseline**

1. Alle **tracked** endringer må **committes**, **stash**es, eller **forkastes** bevisst.  
2. Alle **4373** untracked paths må **legges til .gitignore**, **committes**, eller **slettes** etter eierskap — ikke gjettet i U101B.  
3. **Staged** innhold må ikke stå «halvt» i index under baseline-krav.

---

## F) Neste minste pakke (én)

| Felt | Innhold |
|------|---------|
| **Navn** | **U102 — Working tree konsolidasjon (eierbeslutning)** |
| **Hvorfor den er neste** | Uten ren tree finnes ingen audit-baseline å binde proof til; alt annet er hypotese. |
| **Hva den lukker** | Entydig tilstand: **én** av: ren match mot `HEAD`, **én** bevisst WIP-branch + commit, eller dokumentert forkastelse — slik at `git status` blir forklarbar og policy-kompatibel. |

---

## G) Sluttdom (én setning)

**Per nå er baseline *ikke audit-gyldig*, HEAD er `a809362e296b80459c1adc2ae5932aeb1cb9b82f`, working tree er *massivt dirty (829 tracked status-linjer, 4373 untracked filer, 825 unstaged diff-filer, 8 staged filer)*, og derfor er status *diskvalifisert for offisiell audit-baseline inntil eget konsolideringsløp.***

# U108 — Baseline freeze retry (sannhetsmåling)

**Dato:** 2026-04-08  
**Formål:** Ny måling etter **U106** (CMS-kjerne), **U107A** (audit-spor), **U107B** (uke-rute-align): kan repoet **nå** rettferdiggjøres som **auditérbar baseline**?

**Dette er ikke proof.**  
**Dette er ikke CI/e2e.**  
**Ingen baseline-freeze ble utført i denne pakken** — kun måling og bindende konklusjon.

**Policy:** `docs/audit/policies/audit-baseline-policy.md` — *Dirty tree = ingen audit-baseline.*

---

## A) HEAD (referanse)

| | |
|--|--|
| **`git rev-parse HEAD`** | `1b6348cd895d8ae76c1b0e6f0d7d94bc43a56e9b` (topp av `rescue-ai-restore` etter U107B-record) |

`HEAD` er **gyldig som SHA for de committene som allerede ligger i historikken** (inkl. U106 / U107A / U107B-linjen). Det er **ikke** automatisk «audit-baseline for hele arbeidskopien» så lenge treet er dirty (jf. policy §1–2).

---

## B) Målinger (denne kjøringen, faktiske tall)

| Måling | Resultat |
|--------|----------|
| `git status --short` (linjer) | **2328** |
| `git diff --stat` (working tree vs index) | **823** filer, **+18050** / **−19599** linjer |
| `git diff --cached --name-only` | **0** filer (tom index — **ingen** staged rot) |
| `git ls-files --others --exclude-standard` | **4367** paths |
| `npm run typecheck` | **PASS** (exit 0) |
| `npm run test:run` | **PASS** — 359 testfiler pass, 4 skipped; 1599 tester pass, 13 skipped |

**Hva dette beviser:** På denne maskinen er **nåværende arbeidskopi** (inkl. lokale endringer) fortsatt typecheck/test-OK.  
**Hva det ikke beviser:** At **HEAD alene** er reproduserbar **audit-baseline** for påstander som krever ren tree — policy krever **ren `git status`** for det som inngår i baseline-påstanden.

---

## C) Sammenligning mot U101B / U102 (ikke magefølelse)

| Måling | U101B (2026-04-08) | U108 (nå) | Kommentar |
|--------|---------------------|-----------|-----------|
| `git status --short` linjer | **2338** | **2328** | Marginal reduksjon (~10 linjer) — **ikke** material endring i «kaos-nivå». |
| Filer med unstaged diff (`git diff --name-only` count) | **825** | **823** | Tilsvarende orden; **fortsatt massiv** tracked WIP. |
| Untracked paths | **4373** | **4367** | **~samme** (~4k u-sporet). |
| Staged (index) | **8** filer (blandet CMS + audit) | **0** filer | **Reell forbedring:** blandet staging fra U101B er **borte** — landet som egne commits (U106/U107). |
| Hovedblokkering | Dirty tree + tusenvis `??` + hundrevis `M`… | **Samme mønster** | U106–U107 **historiserer** tidligere «kritiske emner»; de **eliminerer ikke** bulk-WIP i working tree. |

**Konklusjon på sammenligning:** De største **strukturelle** blokkeringene fra U101B (blandet index, portal vs app week, audit i staging) er **adressert i git-historikk**. Den **dominerende** blokkeringen — **tusenvis av u-sporede filer** og **hundrevis av endrede tracked filer** — er **fortsatt til stede** i samme størrelsesorden som U101B/U102.

---

## D) Dominante kategorier (indikativ prefiks-telling på `git status --short`)

| Prefiks / område | Ca. antall linjer (indikativ) |
|------------------|-------------------------------|
| `app/` | 672 |
| `lib/` | 991 |
| `components/` | 94 |
| `tests/` | 292 |
| `e2e/` | 25 |
| `docs/` (inkl. ikke-`docs/audit` committet) | 72 |

(Tall er **indikator** fra enkel path-match; én linje kan være `MM` osv.)

---

## E) Vurdering mot policy (én av tre — bindende)

**Valgt: *Baseline kan fortsatt ikke fryses ærlig* for hele arbeidskopien.**

**Begrunnelse:**

1. **`audit-baseline-policy.md` §1–2:** Krever bl.a. **ren** `git status` for det som inngår i baseline-påstanden; **dirty tree = ingen audit-baseline.**
2. **Faktiske tall:** ~**823** filer med diff mot index og ~**4367** u-sporede paths — det er **ikke** «litt støy», det er **fortsatt massiv, blandet WIP**.
3. **`HEAD` som kandidat:** Kan brukes som **entydig commit-referanse** for **allerede committet** arbeid (U106/U107), men **ikke** som «frosset baseline for repo+WT» uten at resten committes, forkastes eller eksplisitt utelates fra påstanden (ingen slik avtale finnes her).

**Ikke valgt:**

- *HEAD kan nå brukes som audit-baseline* — **nei** for **hele** arbeidskopien; policy blokkerer.
- *Ny baseline-commit må fortsatt lages* — teknisk **ja** hvis målet er å fange alt — men det er **ikke** «minste pakke» og krever **eierbeslutning** (innhold/scope), ikke bare «én commit».

---

## F) Baseline-status (klassifikasjon)

| felt | verdi |
|------|--------|
| **Gyldig audit-baseline for nåværende working tree?** | **Nei** — **fortsatt ugyldig** |
| **Nesten gyldig?** | **Nei** — volum og `??` er fortsatt dominerende |
| **Bedre enn U101B på git-disiplin?** | **Ja, på margin:** historiserte commits, **tom index**, week+audit+CMS spor i historikk |
| **Like ille på rot-volum?** | **Ja** — u-sporet og tracked-WIP er **samme størrelsesorden** |

---

## G) `docs/audit`-tre (filer under `docs/audit`, maxdepth 4)

**70 filer** under `docs/audit/**` i denne arbeidskopien (inkl. policies, full-system, parts, tools, U10x-records). Mange av disse er fortsatt **`??` mot `HEAD`** utenom de som allerede ble innlemmet i U107A/U107B — **ikke** «audit-baseline = alt i docs/audit er sporet» uten videre commit-arbeid.

---

## H) Én neste pakke (minste som følger av funnene)

| felt | verdi |
|------|--------|
| **Navn** | **owner review — remaining untracked + WIP scope** |
| **Hvorfor** | Største gjenværende blokkering er **~4k u-sporet** + **~823** tracked diffs — ikke løst av U106–U107. U102/U103 pekte allerede på **eierbeslutning** før masse-commit eller discard. |
| **Hva den lukker** | Skriftlig **scope/keep/discard** for rest-treet (eller eksplisitt «ingen baseline før X») — **ikke** baseline-freeze i seg selv. |

---

## I) Sluttdom (én setning)

Per nå er baseline-status **fortsatt ugyldig for audit-freeze av hele arbeidskopien**, **`HEAD` er en entydig SHA for allerede landede commits men ikke for ucommittet masse**, og derfor er neste ærlige steg **owner review av gjenværende untracked/WIP (ikke proof, ikke baseline-commit i blindo).**

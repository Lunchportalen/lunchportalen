# U114 — Scoped baseline-prep: vurdering av delsett (git-sannhet)

**Dato:** 2026-04-09  
**HEAD ved måling:** `e5c889cf315f9b75a2a221118cedfe05c7701599`  
**Status:** **Ikke** proof. **Ikke** full repo-baseline. Kun vurdering av om et **isolert** keep-scope finnes og tåler baseline-prep.

---

## A) Hva U113 faktisk isolerte (bekreftet mot `docs/audit/U113_scoped_app_lib_split_record.md`)

| Påstand i U114-opphav | Git-sannhet |
|------------------------|-------------|
| U113 skulle isolere U112-godkjent `app/**` + `lib/**` | **Nei.** U113-record: **ingen** `git add` av `app/` eller `lib/`; **ingen** commit av keep-candidates. Teknisk spor ble **ikke** opprettet. |
| Hvilke blokker som ble «isolert» | **Ingen.** Hele `app`+`lib` WIP ligger fortsatt som **ustaget** working tree + `??`. |

**U112** (`docs/audit/U112_owner_binding_app_lib_scope.md`) definerer **MED VIDERE** vs **UTENFOR BASELINE NÅ**, men **ingen påfølgende U113-kjøring** har committet det MED VIDERE-settet. Historikk etter `72346ec…`: kun **audit**-commits (`U113` stopp-notat, `U112` binding).

**Eksplisitt holdt utenfor (U112):** bl.a. `app/saas/**`, `app/public/**` (flat), `app/product/**`; alle `lib/<segment>/` med `diff=0` og `untracked≥1`. *(U114 måler ikke disse; de er fortsatt i arbeidskopien som `??`.)*

---

## B) Subset mot virkeligheten (kun det som *skulle* vært isolert — implisitt MED VIDERE per U112)

**Måling kun `app` + `lib`:**

| Signal | Verdi |
|--------|--------|
| `git diff --cached --name-only -- app lib` | **0** paths |
| `git diff --name-only -- app lib` | **652** paths (ustaget endring) |
| `git diff --shortstat -- app lib` | 652 files changed, 13790 insertions(+), 16230 deletions(-) |
| `git ls-files --others --exclude-standard app lib` | **2163** paths |

**Tolkning:**

- **Ingen** isolert subset i **git**: HEAD inneholder **ikke** et skiltet `app`+`lib` keep-spor; alt er fortsatt **ustaget** og blandet med resten av repo-WIP i praksis.
- **Ustabilt subset:** Selv innenfor **MED VIDERE**-*intensjon* (U112) ligger det fortsatt **massiv** `??` i stormsentre (`app/api`, `app/(backoffice)`, `lib/ai`, …) — dokumentert tidligere; U114 re-teller ikke hver fil, men **2163** `??` under `app`+`lib` alene er **ikke** «rent» for baseline-kandidat.
- **Sammenheng / lekkasje:** U114 måler **ikke** hele repoet; likevel: `app/**` og `lib/**` er **ikke** arkitektonisk lukket — de bygger på felles `components/**`, konfig, tester. Uten committed subset og uten å måle imports er **full** lekkasje-uavhengighet **ikke** påvist; med **ingen git-isolasjon** er scoped baseline-prep **ærlig sett ikke startet**.

`npm run typecheck` — **PASS.** `npm run test:run` — **PASS** (359 filer / 1599 tester grønne). *Det beviser ikke at et ucommitted delsett er baseline-klart.*

---

## C) Scoped baseline-status (én)

**SCOPED BASELINE ER FORTSATT FOR UREN**

**Begrunnelse:** Det finnes **intet** eget git-spor for U112 MED VIDERE `app`+`lib` (U113 ble ikke teknisk fullført). **652** ustagede filer og **2163** untracked under `app`+`lib`, **0** staged — subsetet er **blandet** og **ikke historisert**. Eksterne leverandør-API-er er **ikke** den primære stoppen; stoppen er **git- og flatetilstand**.

---

## D) Neste pakke (én)

**U113 — Teknisk git-split (utfør):** stage + commit **kun** U112 **MED VIDERE** paths (audit i **annen** commit enn produktkode), slik at et **konkret** subset faktisk finnes i historikk og kan vurderes på nytt for baseline-prep.

**Hva den lukker:** Oppretter det isolerte tekniske sporet U114 forutsatte — uten det er «scoped baseline-kandidat» tomt.

---

## E) Sluttdom

**Per nå er scoped subset ikke isolert i git (U113 utført ikke split), og derfor er neste ærlige steg U113 teknisk split av U112 MED VIDERE `app`+`lib` før ny baseline-prep-vurdering.**

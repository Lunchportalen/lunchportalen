# U103 — Owner review split (binding record)

**Date:** 2026-04-08  
**HEAD:** `a809362e296b80459c1adc2ae5932aeb1cb9b82f`  
**Package:** U103 (emneinndeling + eierbeslutninger på papir; ikke teknisk split, ikke commit, ikke baseline/proof/CI)

## Målinger (denne kjøringen)

| Måling | Verdi |
|--------|--------|
| `git rev-parse HEAD` | `a809362e296b80459c1adc2ae5932aeb1cb9b82f` |
| `git diff --stat` (unstaged) | **825** filer, **+18050 / −21118** linjer |
| `git diff --cached --stat` | **8** filer, **+4959 / −8296** linjer |
| `git ls-files --others --exclude-standard` | **4374** filer (samme orden som U102) |
| `npm run typecheck` | **exit 0** (~81s) |
| `npm run test:run` | **exit 0** — 359 testfiler passert, 4 hoppet over; 1599 tester passert, 13 hoppet over |

**Merk:** Typecheck/test gjelder nåværende arbeidskopi (inkl. lokale endringer). Det beviser ikke at HEAD alene er en deklarert baseline.

**Disk-telling (nåværende tre, inkl. u-sporet):** `app` 1194 filer · `lib` 2126 · `components` 287 · `docs/audit` 64 · `tests` 376 · `e2e` 44.

## 1) Identifiserte emner (papir)

Se hovedleveransen i PR/kommentar; oppsummering:

| Emne | Kort status |
|------|-------------|
| A — Backoffice CMS / content workspace | **KREVER EIERVALG** (kjerne-WIP, MM/staged) |
| B — Staged kjerne + audit-logger (index) | **KREVER EIERVALG** (blandet CMS + `docs/audit/full-system/*`) |
| C — Auth / login / session-ruter | **KREVER EIERVALG** (frostede flyter berørt) |
| D — Uke-visning: `(portal)` slettet vs `(app)` u-sporet | **KREVER EIERVALG** (én sann rute) |
| E — Offentlig forside / marketing-komponenter | **KREVER EIERVALG** (mange slettinger i `components/`) |
| F — APIflate (bred `app/api/**`) | **FOR UKLART TIL Å SPLITTES NÅ** uten A+C |
| G — `lib/**` parallell tre (mange nye u-sporede domener) | **KREVER EIERVALG** (leveranse vs. eksperiment) |
| H — Tester + e2e (sporet + u-sporet) | **FOR UKLART TIL Å SPLITTES NÅ** uten A–G |
| I — Konfig / CI / toolchain | **KAN SPLITTES DIREKTE** *etter* eier om hvilken baseline disse skal lande på |
| J — Studio / Sanity / ukeplan-schema | **KREVER EIERVALG** (koblet til uke + CMS) |
| K — Docs / audit / rot-rapporter (u-sporet `docs/**` + `REPO_DEEP_DIVE_REPORT.md` m.m.) | **KREVER EIERVALG** (leveranse vs. arbeidsstøy) |
| L — `artifacts/**`, `supabase/**`, `utils/**`, `workers/**`, `.cursor/**`, Docker | **KREVER EIERVALG** (generert/infra vs. produkt) |

## 2) Kan splittes direkte

- **Ingen stor emne-blokk** er trygt «rent teknisk» splittet før eier har tatt stilling til **rute-sannhet (uke)**, **CMS-kjerne**, og **hva u-sporet `lib/**`-masse er**.  
- **Konfig/CI/tooling (I)** er *nærmeste* kandidat til isolasjon, men **må ikke** blandes med CMS/auth/uke i samme commit når split først utføres.

## 3) Krever eiervalg

- A, B, C, D, E, G, J, K, L (se tabell).

## 4) For uklare til å splittes nå

- F (API), H (tester) — fordi de er **krysskoblet** til kjerneemner og index/WT-tilstand.

## 5) Anbefalt split-rekkefølge (kun plan)

1. **D** — Uke-rute: bekreft mål-plassering (`(app)` vs gjenopprett `(portal)` / annet) før videre UI/API/test-arbeid låses.  
2. **B** — Beslutte om staged **8-filer** skal forbliver én enhet eller splittes (CMS vs audit-logger).  
3. **A** — CMS/content workspace (tracked + avhengige u-sporede filer) etter B+D.  
4. **C** — Auth/login bare etter eksplisitt risikovurdering (frostede flyter).  
5. **G + J** — `lib` og studio i samme «arkitektur»-runde, ikke blandet med E.  
6. **E** — Forside/marketing etter at nav/komponent-sannhet er avklart.  
7. **I** — Tooling når mål-baseline for commit er valgt.  
8. **F + H** — API og tester sist som integrerende lag, **ikke** i samme commit som A eller D.

**Skal ikke blandes i samme commit:** (A+B) med (D); (C) med (E); (I) med (A).

## 6) Neste minste pakke (én)

**Navn:** `U104 — Eierbeslutninger (bindende): uke-rute + staged kjerne (CMS vs audit)`  

**Hvorfor:** U102/U103 peker på **delvis staged indeks**, **slettet `app/(portal)/week/**`**, og **u-sporet `app/(app)/week/**` som ikke kan være én sann tilstand uten eier.**  

**Hva den lukker:** Skriftlig JA/NEI på **kanonisk uke-rute** og på **om staged innhold skal committes som én kjerne eller splittes** — forutsetning for første ærlige git-split, ikke erstatning for baseline-freeze.

## 7) Sluttdom (én setning)

Per nå er working tree **emne-delt på papir, men ikke kontrollert i git**, og derfor er neste ærlige steg **bindende eierbeslutning om uke-rute og staged CMS/audit-kjerne (U104), ikke baseline-freeze og ikke teknisk mass-split uten de valgene.**

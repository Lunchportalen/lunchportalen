# Audit baseline policy (Lunchportalen)

**Status:** BINDENDE.

## 1. Når repo regnes som auditérbar baseline

Kun når **alle** er oppfylt:

- `git status` er **rent** for det som inngår i påstanden (ingen uventede `M`, `A`, `D`, `??` for relevante paths).
- Alle endringer som skal inngå i baseline er **committet**.
- Det finnes én entydig **`git rev-parse HEAD`** som dokumentasjon eller proof kan referere til.

## 2. Når dirty tree diskvalifiserer proof

**Alltid** for E4 og for “100 %”-påstander:

- Enhver ucommittet endring i produkt-/test-/konfigurasjonsfiler som kan påvirke atferd, gjør at **ingen** proof kan sies å gjelde “kodebasen” — kun “denne arbeidskopien, ulåst”.

**Regel:** *Dirty tree = ingen audit-baseline.*

## 3. Hva som må være committet

- Alt som proof skal attestere (kode, tester, e2e, scripts som inngår i kjeden).
- Manifest og gate-filer som skal være del av offisiell proof-pakke.

## 4. Hva som kan være untracked

Kun filer som **eksplisitt** er utelatt fra baseline-påstanden (f.eks. lokale `.env`, editor-filer) og som **ikke** påvirker reproduserbarhet. De skal ikke refereres i manifest for offisiell proof.

## 5. Proof og commit SHA

Enhver offisiell proof-pakke skal enten:

- inneholde `commitSha` felt (anbefalt), eller
- være ledsaget av et dokument som angir **eksakt** `git rev-parse HEAD` på tidspunktet for kjøring.

Uten SHA er bindingen mellom **kode** og **artifacts** svak — maks **lokal hypotese**, ikke audit-baseline.

## 6. Release-proof og git-tilstand

Release-proof krever:

- **Tag eller release-branch** peker til samme commit som artifacts, **eller**
- CI-artifacts med **innebygd SHA** fra bygget som produserte dem.

**Ikke akseptabelt:** “Bygget er grønt” uten lagret SHA og lagrede artifacts.

## 7. Kort sluttregel

**Baseline = ren tree + kjent HEAD + manifest/artifacts knyttet til den HEAD.** Alt annet er dokumentasjon av en eksperimentell tilstand, ikke produksjons-/audit-sannhet.

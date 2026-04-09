# U30X-READ-R3 — Docs trust and delete candidates

**Handling:** Ingen filer slettet i denne fasen (read-only).

## Metode

- Repoet har **mange** eksisterende filer under `docs/umbraco-parity/` (hundrevis) inkl. `U30_*`, `U29_*`, `CP13_*`, …  
- **Kilde-sannhet** er kode: `backofficeExtensionRegistry.ts`, `ContentWorkspace.tsx`, API-ruter, `moduleLivePosture.ts`.

## Klassifisering (mønstre)

| Klasse | Eksempel-mønster | Begrunnelse |
|--------|------------------|-------------|
| CANONICAL | `lib/cms/backofficeExtensionRegistry.ts` (ikke .md) | Kode — ikke doc |
| SUPPORTING | `U30X_*` runtime rapporter som matcher grep på faktiske routes | **SUPPORTING** hvis konsistent med kode |
| HISTORICAL | Eldre `phase2*`/`deep-dive` hvis refererer til slettede filer | **HISTORICAL** |
| SUPERSEDED | Flere `U30`, `U30R`, `U30X_READ` varianter av samme tema | Risiko for **DUPLICATE** |
| MISLEADING | Dok som hevder «full» Umbraco parity / Editor 2.0 uten å nevne `_stubs` `Editor2Shell` | **MISLEADING** |
| DELETE_CANDIDATE | Dok som dupliserer ny `U30X_READ_R3_*` serie uten unikt innhold | **DELETE_CANDIDATE** (senere) |

## DELETE_CANDIDATE (eksempler — må verifiseres manuelt før sletting)

| Fil | Hvorfor skadelig | Erstatning | Trygg sletting senere? |
|-----|------------------|------------|-------------------------|
| Eldre `U30_READ_*` som overlapper `U30X_READ_R3_*` (samme tema) | Dobbelt sannhet | **U30X_READ_R3_** serien + kode | Kun etter eier-review |
| Dok som beskriver `BackofficeTenantsContext` eller slettede shell-filer (git status viser `D` på flere) | Henviser til fjernet kode | **Kode** + oppdatert baseline | Ja etter verifisering |

**Git status (ved sesjon start)** viste slettede filer: `BackofficeTenantsContext.tsx`, `ModulesRail.tsx`, `ContentPageClient.tsx`, `WeekClient.tsx`, … — **docs som refererer til disse er DOC_DRIFT**.

## Sluttdom

Stol på **kode + migrasjoner**; bruk `docs/umbraco-parity/` som **historikk/støtte** med **DUPLICATE**-fare. **MISLEADING** — alt som sier «nær Umbraco 17» uten å liste **STRUCTURAL_GAP** punkter fra denne R3-serien.

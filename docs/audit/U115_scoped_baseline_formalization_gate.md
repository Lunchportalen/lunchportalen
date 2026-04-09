# U115 — Formal scoped baseline record (audit-only)

Dato: 2026-04-09  
HEAD ved formalisering: `be8235b996d8958a69b90a7d8595201238601c74`

Dette er ikke proof.  
Dette er ikke release.  
Dette er ikke full repo-baseline.

## U114-gate (bindende)

Kilde: `docs/audit/U114_scoped_baseline_prep_record.md`

U114-konklusjon: **SCOPED BASELINE-KANDIDAT KAN NÅ FORBEREDES**.

U115 er derfor tillatt.

## Scoped baseline SHA og subset

Scoped baseline referanse (produktkode): `0ab2cf35138e8d4204df32d01543a65567d9438d`  
Kilde for split: `docs/audit/U113_scoped_app_lib_split_record.md`

Subset denne scoped baseline gjelder for:

- U112 MED VIDERE under `app/**` + `lib/**`
- Praktisk kjerne fra U113: `app/(backoffice)/**`, `app/api/**`, `app/layout.tsx`, `app/globals.css`, `lib/enforce.ts`, `lib/grouping.ts`, og `lib/<segment>/**` der segmentet hadde tracked diff

## Hva denne scoped baseline betyr

- Auditérbar referanse for et avgrenset subset
- Ikke proof
- Ikke release
- Ikke full repo-baseline

## Eksplisitt utenfor scoped baseline

- `app/saas/**`
- `app/public/**` (flat)
- `app/product/**`
- `lib/<segment>/**` med `diff=0` og kun untracked (U112: UTENFOR BASELINE NÅ)
- Alt utenfor `app/**` og `lib/**` (`components/**`, `tests/**`, `e2e/**`, `artifacts/**`, config og øvrig repo)

## Pakker som muliggjorde formalisering

- `U112` — eierbinding av MED VIDERE/utenfor-scope
- `U113` — teknisk split og produktkode-commit for scoped subset
- `U114` — scoped baseline-prep-vurdering med grønt lys

## Neste pakke (én)

`proof inventory normalization for scoped subset relevance`

Formål: bygge ren proof-inventar koblet kun til scoped baseline-subsettet uten å blande inn full repo.

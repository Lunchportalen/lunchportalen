# U121 — Subset proof gap closure planning (scoped only)

Dato: 2026-04-09  
HEAD ved vurdering: `9c06d1cb3642ca52bd6520142811599299eacdd1`

Dette er ikke proof-kjoring.  
Dette er ikke CI/e2e-plan.  
Dette er ikke proof-completion.

## Kildesannhet brukt i U121

- `docs/audit/U120_scoped_manifest_gate_gap_clarification_record.md`
- `docs/audit/U119_strengthen_weakest_relevant_proof_package_record.md`
- `artifacts/u97e-content-structure-create-flow-proof/proof-manifest.json`
- Filoversikt `artifacts/u97g-content-structure-live-proof/*`
- Filoversikt `artifacts/u97e-content-structure-create-flow-proof/*`

## Gjenstaende scoped proof-gap (kun to)

1. `u97g-content-structure-live-proof` — mangler manifest.
2. `u97e-content-structure-create-flow-proof` — mangler gate/logg + sterk same-run-kjede.

Ingen andre scoped kandidater inngar i denne planen.

## Hard prioritering (bindende rekkefolge)

### 1) Tas forst: `u97g-content-structure-live-proof`

Hvorfor:

- Minste tekniske inngrep med hoy sannhetsgevinst: fra binar+gate/logg uten pakkeidentitet til eksplisitt, deklarert pakke.
- Lavest risiko: krever ikke ny bred kjoreflate for gate/proof.
- Haper ikke over svak chain i `u97e`; rydder opp et rent manifest-gap forst.
- Reduserer tvetydighet raskt uten a late som full closure.

### 2) Tas etterpa: `u97e-content-structure-create-flow-proof`

Hvorfor den ma vente:

- Gapet er storre: krever gate/logg-materiale og dokumentert same-run-kjede.
- Hoyere operasjonell bredde enn ren manifest-tilfying.
- Uten forst a lukke `u97g` blir rekkefolgen mindre deterministisk og mindre smal.

## Ferdig nok (reklassifiseringsterskel) per pakke

### `u97g-content-structure-live-proof` — ferdig nok

Maa vere pa plass:

- `proof-manifest.json` i pakken.
- Manifestet ma eksplisitt peke til eksisterende evidensfiler i samme pakke (gate/logg/binar som allerede finnes).
- Manifestet ma beskrive status sannferdig (ingen completion-pastander).

Kan fortsatt ikke pastas etter lukking:

- At scoped proof-sporet er komplett.
- At `u97e` er grunnlag-klar.
- At dette alene er same-run-verifisert completion.

Maa dokumenteres eksplisitt:

- At dette lukker kun manifest-gapet i `u97g`.
- At `u97e` fortsatt star igjen med gate/chain-gap.

### `u97e-content-structure-create-flow-proof` — ferdig nok

Maa vere pa plass:

- Ikke-null gate/logg-koblinger for `typecheck`, `lint`, `buildEnterprise`, `testRun`.
- Dokumentert runtime/gate-kjede i samme pakke (same-run chain), ikke bare losrevne metadata.
- Manifeststatus oppdatert fra `partial` med konkret begrunnelse bundet til faktiske filer.

Kan fortsatt ikke pastas etter lukking:

- Full scoped proof-completion utover de to identifiserte gapene.
- Bred helrepo-verifisering.

Maa dokumenteres eksplisitt:

- Hvilke konkrete filer utgjor gate/logg-chain.
- Hva pakken beviser, og hva den ikke beviser.

## Neste tekniske pakke (kun en)

`add manifest to u97g-content-structure-live-proof`

Hvorfor akkurat denne:

- Den folger direkte av prioriteringen over.
- Det er minste reelle lukking med hoy sannhetsgevinst og lavest bredde.
- Den lar `u97e`-arbeidet tas i neste, separat pakke uten scope-blanding.

Hva den lukker:

- Kun manifest-gapet i `u97g-content-structure-live-proof`.

## Sluttgrense

Denne planen lukker ikke proof. Den binder kun rekkefolge og terskler for de to gjenstaende scoped gapene.

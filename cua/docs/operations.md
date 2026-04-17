# Operations runbook — policy_merge

## Formål

Sikker sammenslåing av Chrome JSON-policyfragmenter med atomisk utskrift, kataloglås mot overlappende kjøringer, og kontrollert arkivering.

## Preflight

1. Bekreft Python **3.11+**: `python --version`
2. Bekreft at inndata er en **katalog** med forventede `*.json`-fragmenter (toppnivå).
3. Sjekk skrivetilgang til katalogen og tilstrekkelig diskplass.
4. Sørg for at `000_policy_merge.json` (eller valgt `--output-name`) **ikke** er en symlink.
5. Sjekk at katalogen **ikke** allerede har en aktiv `.policy_merge.lock` fra en annen kjøring (eller forstå recovery-flyten under).

## Dry-run (obligatorisk første gang i miljø)

```bash
policy-merge --input /path/to/dir --dry-run --verbose
```

Eldre automasjon kan fortsatt bruke f.eks. `policy-merge path=/path/to/dir merge_keys=ManagedBookmarks --dry-run` (siste er no-op; se README).

Forventet:

- Ingen ny `000_policy_merge.json`, ingen `policy_merge_archive/`.
- Låskatalog `.policy_merge.lock` opprettes og fjernes igjen ved suksess (kort levetid). Innhold: `owner.json` med `pid`, `hostname`, `created_at` (UTC).
- Oppsummering med antall mergede filer og ignorerte oppføringer.

## Normal kjøring

```bash
policy-merge --input /path/to/dir --verbose
```

Etter kjøring:

- `000_policy_merge.json` oppdatert (atomisk).
- Fragmentfiler flyttet til `policy_merge_archive/<tidsstempel>_<unik>/`.
- Eksisterende output sikkerhetskopieres i samme arkivmappe før erstatning (second pass).

## Låskonflikt (exit code 6)

Symptom: melding om at en annen kjøring holder lås, eller at låsemappen har ugyldig metadata.

1. Bekreft at ingen annen `policy-merge` kjører mot samme katalog (prosessliste / orchestrator).
2. Hvis låsen er etter et **krasj**: les `.policy_merge.lock/owner.json` (eller eldre `pid`-fil). Er prosessen borte, fjernes stale lås **automatisk** ved neste kjøring.
3. Hvis **metadata mangler eller er korrupt** (ugyldig JSON, tom mappe, ugyldig pid): kjøring feiler med exit **6** til du har verifisert at ingen annen prosess kjører; fjern mappen manuelt eller kjør én gang med `--break-lock` (flagget fjerner **ikke** aktiv lås med levende pid).

## Recovery etter avbrudd

1. **Før siste vellykkede merge**: gjenopprett fra `policy_merge_archive/.../000_policy_merge.before_replace.json` (hvis tatt) og fragmentfiler kopiert fra arkiv.
2. **Lås igjen etter krasj**: hvis `.policy_merge.lock` ligger igjen og blokkerer, se avsnittet over.
3. **Git / backup**: hvis katalogen er versjonert, revert til kjent bra commit.
4. **Delvis arkivering**: ved I/O-feil under flytting etter vellykket `replace` kan noen fragmenter være flyttet og andre ikke; sammenlign arkivmappe med forventet liste og flytt tilbake manuelt ved behov.

## Tolking av logger

- **WARNING**: ignorerte filer/kataloger (forventet ved blandet innhold).
- **INFO**: arkiverte fragmenter, backup av tidligere output.
- **ERROR**: valideringsfeil, låskonflikt, eller I/O-feil; se exit code.

## Exit codes (kort)

| Code | Handling |
|------|----------|
| 0 | OK — verifiser output og arkiv |
| 2 | Rett CLI og kjør på nytt |
| 3 | Rett `--input`-sti |
| 4 | Rett JSON / fjern symlink output / legg inn fragmenter |
| 5 | Sjekk disk, tillatelser, låste filer |
| 6 | Lås holdt av annen prosess, eller korrupt lås — se «Låskonflikt» |

## Manuell verifikasjon etter kjøring

- `000_policy_merge.json` er gyldig JSON og har forventede nøkler.
- Antall flyttede fragmenter stemmer med forventning.
- Ingen varselstorm uten forklaring (kan tyde på feil katalog).

## Incident checklist

- Samle full kommando + stdout/stderr.
- Behold kataloglisting før/etter (inkl. `.policy_merge.lock` om relevant).
- Ikke slett `policy_merge_archive` før årsak er funnet.

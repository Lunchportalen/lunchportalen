# CUA Chrome — policy merge

Lite Python-verktøy som slår sammen flere JSON-policyfragmenter i én katalog (kun toppnivå, ikke rekursivt) til én deterministisk utdatafil for videre bruk i Chrome policy-arbeidsflyt.

## Hva verktøyet gjør

- Leser **kun vanlige** `*.json`-filer i angitt inndatakatalog.
- Slår sammen innhold med **dyp sammenslåing** av objekter og **konkatenering** av lister med samme nøkkel etter rekkefølge.
- Skriver resultatet til **`000_policy_merge.json`** (kan overstyres med `--output-name`).
- Flytter prosesserte fragmentfiler til `policy_merge_archive/<UTC-tidsstempel>_<unik>` etter vellykket kjøring (ikke i `--dry-run`).
- Ved **second pass**: hvis `000_policy_merge.json` allerede finnes, leses den **først**, deretter øvrige `*.json` i **leksikografisk rekkefølge**.

## Forventede inndata

- Én katalog med JSON-filer på **toppnivå** (undermapper ignoreres med advarsel).
- Hver JSON-fil må ha et **objekt** (`{}`) på rot-nivå.

## Utdata

- Standard: `000_policy_merge.json` i samme katalog som inndata.
- JSON skrives med sorterte nøkler, UTF-8 og avsluttende linjeskift.

## Second pass

Når merged fil allerede finnes, inkluderes den som **første** lag i merge. Nye fragmenter legges oppå. Dette gjør det trygt å kjøre verktøyet gjentatte ganger når nye policyfiler dukker opp.

## Samtidige kjøringer (lås)

Én aktiv kjøring per inndata-katalog. Verktøyet oppretter en eksklusiv katalog ``.policy_merge.lock`` under inndata (atomisk ``mkdir``), skriver ``owner.json`` med ``pid``, ``hostname`` og ``created_at`` (UTC ISO-8601), og fjerner hele låskatalogen ved normal avslutning (også ved feil etter vellykket lås).

- **Aktiv lås:** ``owner.json`` (eller eldre ``pid``-fil) gir et gyldig heltalls-pid som fortsatt **kjører** på verten → **exit code 6** (`LockHeldError`).
- **Stale lås:** pid finnes og er **ikke** lenger en levende prosess → låskatalogen fjernes automatisk, deretter fortsetter kjøringen.
- **Korrupt / ufullstendig lås:** mappen finnes, men metadata kan ikke leses som forventet (manglende fil, ugyldig JSON, ugyldig pid) → **exit code 6** (`StaleLockError`) til du manuelt fjerner mappen eller kjører én gang med ``--break-lock`` etter å ha bekreftet at ingen annen kjøring er aktiv.
- **``--break-lock``:** fjerner **kun** stale eller korrupt/ufullstendig lås. Den fjerner **aldri** en lås der eier-pid fortsatt kjører.

Eldre låser kan fortsatt bare ha en ``pid``-tekstfil (uten ``owner.json``); de behandles som i dag for stale-sjekk.

``--dry-run`` tar **samme lås** som skrivekjøring (unngår overlapp mellom dry-run og ekte merge).

## Kjøring lokalt

Krever **Python 3.11+**.

```bash
cd cua
python -m venv .venv
# Windows: .venv\Scripts\activate
# Unix: source .venv/bin/activate
pip install -e .
policy-merge --input /path/to/policy/dir --dry-run
policy-merge --input /path/to/policy/dir --verbose
```

Alternativt uten pakke-installasjon (kun for enkeltkjøring av CLI-modulen; **unittest forutsetter** installert pakke, se under):

```bash
cd cua
set PYTHONPATH=cua_chrome   # Unix: export PYTHONPATH=cua_chrome
python -m cua_chrome.core.policy_merge --input /path/to/dir
```

### Legacy CLI

Eldre kall oversettes før argparse:

- `path=/mappe`, `--path=/mappe` eller `--path /mappe` → `--input` med samme sti.
- `merge_keys=…`, `merge-keys=…`, `--merge-keys …` (eller `--merge_keys`) → **ignorert** (historisk nøkkelfilter; dagens verktøy merger hele objektet fra hvert fragment).

## Eksempel

```bash
policy-merge --input ./policies --verbose
```

Innhold:

- `10-base.json`, `20-extensions.json` → merges i sortert rekkefølge til `000_policy_merge.json`, deretter arkiveres fragmentene.

## Exit codes

| Code | Betydning |
|------|-----------|
| 0 | Suksess |
| 2 | Ugyldige CLI-argumenter (`--help` gir **0**, ikke 2) |
| 3 | Inndatasti finnes ikke eller er ikke katalog |
| 4 | Data-/valideringsfeil (tom katalog, ugyldig JSON, ikke-objekt rot, symlink output, osv.) |
| 5 | I/O-feil under skriving eller flytting |
| 6 | Låskonflikt eller ugyldig låsmetadata (annen kjøring aktiv, eller korrupt ``.policy_merge.lock`` uten trygg auto-gjenoppretting) |

## Failure modes

- **Blandet katalog**: Ikke-JSON, logger, midlertidige mønstre, kataloger, symlinks og skjulte filer **ignoreres med advarsel** (kanonisk policy). Verktøyet skal ikke krasje på «støy».
- **Ugyldig JSON / ikke-objekt**: Kjøring stopper **før** utskrift eller arkiv; eksisterende `000_policy_merge.json` endres ikke.
- **Delvis arkiv ved skrivefeil**: Hvis sikkerhetskopi av tidligere output er tatt, men atomisk utskrift feiler, kan det finnes en arkivmappe med backup. Se `docs/operations.md`.

## Trygg bruk i produksjon

- Kjør alltid **`--dry-run`** først i nye miljøer.
- Ta katalogbackup eller versjoner i Git før første skrivekjøring.
- Kontroller logger (`INFO`/`WARNING`/`ERROR`) for ignorerte filer.
- Ikke legg hemmeligheter i JSON som logges; verktøyet logger kun filnavn og baner.

## Begrensninger og antagelser

- Kun **toppnivå** filer; ingen rekursjon i undermapper.
- **Symlinks** støttes ikke som kilder eller som output-fil.
- **Kanonisk ignorering**: Ukjente/ikke-forventede filtyper stopper **ikke** kjøring (kun advarsel).
- Arkiv og output forutsetter skrivetilgang på samme volum som inndata (atomisk `replace`).

## Tester

```bash
cd cua
pip install -e .
python -m unittest discover -s tests -v
```

## Dokumentasjon

- Drift: [docs/operations.md](docs/operations.md)
- Arkitektur: [docs/architecture.md](docs/architecture.md)
- Release: [docs/release-checklist.md](docs/release-checklist.md)
- Implementasjonsnotat: [docs/IMPLEMENTATION_SUMMARY.md](docs/IMPLEMENTATION_SUMMARY.md)
- Avsluttende hardening-rapport: [docs/FINAL_HARDENING_REPORT.md](docs/FINAL_HARDENING_REPORT.md)
- Endringslogg / sikkerhet: [CHANGELOG.md](CHANGELOG.md), [SECURITY.md](SECURITY.md)

### Merk om monorepo

Rotnivå ``docs/audit/`` i Lunchportalen-repoet er et **historisk øyeblikksbilde** av hele webplattformen og beskriver **ikke** dette Python-verktøyet. For policy merge, bruk dokumentasjonen under ``cua/docs/`` og [docs/audit/README.md](docs/audit/README.md) her.

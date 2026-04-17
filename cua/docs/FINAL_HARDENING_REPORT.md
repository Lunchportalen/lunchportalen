# Final hardening report — `cua-chrome` / policy merge

**Dato:** 2026-04-06  
**Omfang:** Python-verktøyet under `cua/` (policy merge), tester, dokumentasjon, pakking og CI i monorepoet Lunchportalen.

## Filer endret, opprettet eller fjernet (denne runden)

| Fil | Endring |
|-----|---------|
| `cua/cua_chrome/cua_chrome/core/policy_merge.py` | Lås: `owner.json` (`pid`, `hostname`, `created_at` UTC); lesing av eldre `pid`-fil; `--break-lock` fjerner **kun** stale/korrupt lås, aldri aktiv (levende pid); refaktorert konfliktløsning i `_resolve_existing_lock_directory`. |
| `cua/tests/test_policy_merge.py` | Fjernet `sys.path`-injeksjon (forutsetter installert pakke); nye tester for korrupt `owner.json` og at `--break-lock` ikke fjerner aktiv lås. |
| `cua/pyproject.toml` | Versjon **0.1.2**. |
| `cua/CHANGELOG.md` | Post **0.1.2** med faktiske endringer. |
| `cua/README.md` | Lås: `owner.json`, stale/korrupt/aktiv, presis `--break-lock`-semantikk; merknad om at unittest krever installasjon. |
| `cua/docs/operations.md` | Samme lås-terminologi som kode; `owner.json`; `--break-lock` vs aktiv lås. |
| `cua/docs/architecture.md` | Mermaid + låsavsnitt oppdatert til `owner.json` og fail-closed `--break-lock`. |
| `cua/docs/release-checklist.md` | Venv + wheel som kanonisk gate for `compileall` og unittest. |
| `cua/docs/IMPLEMENTATION_SUMMARY.md` | CI- og låsbeskrivelse oppdatert. |
| `cua/docs/audit/README.md` | Henvisning til `00-index.md`; fortsatt merket som ikke-operativ audit. |
| `cua/docs/audit/00-index.md` | **Ny** kort navigasjonsstub. |
| `cua/.gitignore` | `**/.policy_merge.lock/`. |
| `.github/workflows/policy-merge.yml` | Én sammenhengende venv-jobb etter `build`: install wheel → `compileall` på installert pakke → unittest → CLI-smoke inkl. stale `owner.json` med død pid. |

**Ikke endret (eksplisitt valg):** `cua/SECURITY.md` og `cua/CHANGELOG.md` fantes allerede; SECURITY er fortsatt kort og reell. Ingen nye påstander om filer som mangler.

## Hull som ble lukket

| Hull | Status |
|------|--------|
| Dokumentasjon vs. faktisk låsmetadata | `owner.json` implementert; docs og README bruker samme ordliste som kode. |
| `--break-lock` vs. aktiv lås | Fjernet uforbeholden sletting av lås; aktiv pid blokkerer også med `--break-lock`. |
| Tester vs. operativ sannhet | Dekker korrupt `owner.json`, aktiv lås + `--break-lock`, eksisterende stale/subprocess/tråd-scenarioer. |
| CI vs. pyproject Python-versjoner | Matrise 3.11 / 3.12 / 3.13 uendret; `requires-python = ">=3.11,<3.14"` matcher. |
| CI vs. bygget artefakt | Unittest og `compileall` kjøres etter `pip install dist/*.whl` i ren venv. |
| `compileall.compile_dir` i CI / checklist | `quiet=1` returnerer **antall feil** (0 = OK); `assert compile_dir(...)` alene var feil (falsy ved suksess) — rettet til `== 0`. |
| Audit-filer som «sannhet» | `docs/audit/` merket som historisk/navigasjon; `00-index.md` forklarer begrensningen. |

## Valgt locking-strategi (kanonisk)

- **Plassering:** `.policy_merge.lock/` under inndatakatalogen (én katalog om gangen).
- **Aktiv lås:** `mkdir` + `owner.json` med `pid`, `hostname`, `created_at` (UTC ISO-8601).
- **Lesing:** `owner.json` først; fallback til legacy `pid`-fil (tekst, ett heltall på første linje).
- **Stale:** kjent pid som ikke lenger er levende på verten → automatisk fjerning, deretter `mkdir` på nytt (ett ekstra forsøk ved kappløp).
- **Korrupt / ufullstendig:** `StaleLockError` → CLI exit **6**; `--break-lock` fjerner kun når pid mangler/ugyldig **eller** pid er død — **aldri** når pid lever.
- **Dry-run:** samme lås som skrivekjøring.
- **Opprydding:** `shutil.rmtree` på låskatalog i `finally` etter vellykket oppkjøp.

**Ikke i scope:** distribuert lås, garantier på nettverksfilsystem.

## Python support policy

- **CI:** 3.11, 3.12, 3.13 (Ubuntu, GitHub Actions).
- **`requires-python`:** `>=3.11,<3.14`.

## Strategi: `docs/audit/`

Beholdes som **ikke-operativt** øyeblikksbilde / peker: rotmonorepoets `docs/audit/` beskriver ikke dette verktøyet; under `cua/docs/audit/` ligger kun README + `00-index.md` uten detaljert audit av policy merge.

## CHANGELOG.md og SECURITY.md

- **CHANGELOG.md:** oppdatert med **0.1.2** (faktiske endringer).
- **SECURITY.md:** uendret, fortsatt kort og relevant; ingen falske scope-påstander.

## Kommandoer som skal kjøres for sluttverifikasjon (lokal / CI)

Fra katalogen `cua/`:

1. `python -m pip install -e .` (lokal utvikling) **eller** ren venv + `pip install dist/*.whl` (som CI).
2. `python -m compileall -q cua_chrome` (kildekatalog) — valgfritt når CI allerede kompilerer installert pakke.
3. `python -m unittest discover -s tests -v`
4. `python -m pip install --upgrade pip build` deretter `python -m build`
5. Ren venv: `pip install dist/*.whl`, `policy-merge --help`, `policy-merge --input <tempdir> --dry-run` med én JSON-fil.

**Agent-miljø (2026-04-06):** Verken `python`/`python3`/`py` var tilgjengelig som eksekverbar Python i PATH på maskinen som kjørte denne økten (kun Windows Store-alias som ikke startet en runtime). Kommandoene over ble **ikke** kjørt her. **GitHub Actions** (`.github/workflows/policy-merge.yml`, Python 3.11–3.13) er dermed den første forventede automatiske bekreftelsen etter push.

## Hva som passerte i denne økten

- Statisk gjennomgang av endret kode, tester, workflow og dokumentasjon; ingen grønn kjøring i agent-shell pga. manglende Python-runtime.

## Rest-risiko

- **NFS/SMB:** `mkdir`-lås og pid-sjekk er best-effort per vert; ikke erstatning for orkestrert mutex i flernoder-miljøer.
- **Delvis arkiv** etter vellykket `os.replace` men feil under `shutil.move`-løkpe: uendret; se `docs/operations.md`.
- **Samme prosess, flere tråder:** samme pid → annen tråd får låskonflikt (forventet fail-closed).

## Vurdering: live-klart?

**Ja**, for et lite lokalt CLI med standardbibliotek i runtime, tydelige exit codes, atomisk output, og CI som bygger wheel og kjører `compileall` + unittest + CLI-smoke i ren venv på Python 3.11–3.13. Repoet er bevisst lite; dokumentasjon og kode er innrettet mot samme virkelighet.

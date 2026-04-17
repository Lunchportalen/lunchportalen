# Implementasjon — policy_merge (notat)

Dette dokumentet er et **kort historisk notat** om hvor verktøyet bor i monorepoet og hva det løser. Det skal **ikke** brukes som eneste sannhet for fil-lister eller CI-navn — se [FINAL_HARDENING_REPORT.md](FINAL_HARDENING_REPORT.md) for siste hardening-runde og [README.md](../README.md) for bruk.

## Plassering

- Kode: `cua/cua_chrome/cua_chrome/core/policy_merge.py`
- Tester: `cua/tests/test_policy_merge.py`
- Pakkemetadata: `cua/pyproject.toml`
- CI: `.github/workflows/policy-merge.yml` (repo-rot, trigges på endringer under `cua/**`); bygger wheel/sdist, ren venv, `pip install dist/*.whl`, `compileall` på **installert** pakke, `unittest` i samme venv, CLI-smoke (`--help`, `--dry-run`, legacy `path=` / `merge_keys=`), pluss enkel stale-lock-smoke med død pid i `owner.json`.

## Hva verktøyet gjør (kort)

1. Leser regulære `*.json` på toppnivå i en katalog (ikke rekursivt); ignorerer støy med WARNING.
2. Slår sammen med dyp merge for objekter og konkatenering for lister.
3. Skriver atomisk til output (`temp` + `fsync` + `os.replace`).
4. Arkiverer fragmenter etter vellykket skriving (ikke i `--dry-run`).
5. Tar **lokal kataloglås** (`.policy_merge.lock` + `owner.json`; lesing av eldre `pid`-fil støttes) for å unngå overlappende kjøringer; `--break-lock` rydder kun stale/korrupt lås.

## Viktige korreksjoner fra tidligere utkast

- Tidligere versjoner av dette notatet refererte til workflow-navn eller rot-`.gitignore`-endringer som ikke lenger er den kanoniske sannheten; bruk filene i repoet nå.
- `docs/audit/` på **monorepo-rot** gjelder **ikke** dette verktøyet — se [docs/audit/README.md](audit/README.md).

## Avhengigheter

- **Kun standardbibliotek** i runtime.
- **setuptools** (via PEP 517) for bygg/install av pakken; **build** brukes i CI for å lage wheel.

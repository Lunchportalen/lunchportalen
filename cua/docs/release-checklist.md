# Release checklist — cua-chrome / policy_merge

## Før release

- [ ] Alle endringer er knyttet til issue/PR med kort begrunnelse.
- [ ] Etter `pip install dist/*.whl` i **ren venv** (fra `cua/`): `python -c "import compileall, pathlib, cua_chrome; assert compileall.compile_dir(pathlib.Path(cua_chrome.__file__).resolve().parent, quiet=1) == 0"` (returnverdi er antall kompileringsfeil).
- [ ] `python -m unittest discover -s tests -v` grønn **i samme venv** (testene importerer installert `cua_chrome`, ikke kilde-hack).
- [ ] `python -m pip install build && python -m build` produserer `dist/*.whl` og `dist/*.tar.gz` uten feil (fra `cua/`).
- [ ] Ren venv: `pip install dist/*.whl` deretter `policy-merge --help` og en kort `--dry-run` mot tempkatalog med én `.json`-fil.
- [ ] README og `docs/*` reflekterer faktisk oppførsel (CLI, exit codes, second pass, lås).
- [ ] Ingen hemmeligheter eller miljøspesifikke stier i dokumentasjonseksempler.
- [ ] `CHANGELOG.md` oppdatert for semver-endringen (ved behov).

## Tester (minimum — automatisert suite)

- Happy path merge og sortert rekkefølge.
- Second pass med eksisterende `000_policy_merge.json`.
- Blandet katalog (ikke-JSON, undermappe).
- Ugyldig JSON / ikke-objekt / CLI exit codes.
- Tom katalog.
- `--dry-run` muterer ikke filer.
- Atomisk skriving og rollback-mønster ved skrivefeil (mock).
- Lås: samtidig tråd, subprocess med aktiv pid, stale pid, korrupt `owner.json`, `--break-lock` for korrupt/stale, og at `--break-lock` **ikke** fjerner aktiv lås.
- Legacy `path=` / `--path=` / `--path`, `merge_keys=` / `--merge-keys`, `--help`, setuptools-entry (`policy-merge`) mot `cli()`.

## Smoke tests (manuelt)

1. Opprett tempkatalog med `a.json` og `b.json`.
2. `policy-merge --input <dir> --dry-run --verbose` → ingen outputfil; lås kommer og går.
3. `policy-merge --input <dir> --verbose` → `000_policy_merge.json` opprettet, fragmenter i arkiv.
4. Legg til `c.json`, kjør igjen → merged inkluderer tidligere output + ny fil.

## Rollback-punkter

- Git tag på forrige stabile versjon av `cua/`.
- Behold eksisterende `policy_merge_archive/` til feilsøking er ferdig.

## Artefakter å verifisere

- `cua/pyproject.toml` versjon bumpet ved behov.
- GitHub Actions workflow `.github/workflows/policy-merge.yml` grønn på PR som berører `cua/**`.
- Ingen genererte filer under `dist/`, `*.egg-info/`, `__pycache__/` committet (skal ignoreres av `.gitignore`).

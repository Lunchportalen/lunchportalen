# Changelog

Alle vesentlige endringer i `cua-chrome` / `policy-merge` dokumenteres her.

Format er basert på [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.2] — 2026-04-06

### Added

- Låsmetadata i ``.policy_merge.lock/owner.json`` (``pid``, ``hostname``, ``created_at`` ISO-8601 UTC), med lesing av eldre ``pid``-fil for bakoverkompatibilitet.
- Tester for korrupt ``owner.json``, og at ``--break-lock`` **ikke** fjerner aktiv lås (levende pid).
- `docs/audit/00-index.md` som kort navigasjonsstub (ikke operativ audit).

### Changed

- ``--break-lock`` fjerner kun **stale** (død pid) eller **korrupt/ufullstendig** lås; den fjerner aldri lås der eier-pid fortsatt kjører.
- CI: unittest og `compileall` kjøres etter installasjon av bygget wheel i ren venv; enkel stale-lock-smoke på slutten.

## [0.1.1] — 2026-04-06

### Added

- Legacy argv: `--path` (to-token), `merge_keys=` / `merge-keys=` / `--merge-keys` (ignorert no-op, dokumentert).
- CI: `compileall` mot installert pakke i smoke-venv; ekstra CLI-smoke med `path=` + `merge_keys=`.

### Changed

- `requires-python` satt til `>=3.11,<3.14` for å matche testmatrise (3.11–3.13).
- `pyproject.toml`: `package-dir = { "" = "cua_chrome" }` og eksplisitt `packages = ["cua_chrome", "cua_chrome.core"]`.

## [0.1.0] — 2026-04-05

### Added

- Lokal kataloglås (`.policy_merge.lock`) med stale-deteksjon og nødflagget `--break-lock`.
- Exit code **6** for låskonflikt / ugyldig låsmetadata.
- Utvidet unittest-dekning (CLI, lås, legacy argv, atomisk skriving).
- CI som bygger wheel, installerer i ren venv, og kjører `policy-merge --help` + dry-run smoke.
- `cua/.gitignore`, `CHANGELOG.md`, `SECURITY.md`, og oppdatert drift-/arkitektur-dokumentasjon.

### Changed

- Workflow-fil navngitt `policy-merge.yml` (erstatter tidligere `cua-policy-merge.yml`).
- `pyproject.toml` utvidet med classifiers, maintainers og tydeligere description.

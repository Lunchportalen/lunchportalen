# Audit-dokumenter og dette verktøyet

## `cua/docs/audit/` (denne mappen)

Historisk / navigasjonsområde. Se [00-index.md](00-index.md) for kort peker. Det finnes **ingen** separat, omfattende audit-rapport for policy merge-verktøyet her; sannhetskilde for oppførsel er kildekode, `tests/`, og øvrige filer under `cua/docs/`.

## Rotnivå `docs/audit/` i monorepoet

Katalogen `docs/audit/` på **repo-rot** (utenfor `cua/`) er et **historisk øyeblikksbilde / pre-hardening-arkiv** knyttet til Lunchportalens hovedapplikasjon (Next.js, drift, CMS, osv.). Den er **ikke** vedlikeholdt som beskrivelse av `cua/`-Python-verktøyet og skal ikke brukes til å vurdere policy merge.

Ved motstrid: stol på `cua/README.md`, `cua/docs/architecture.md`, `cua/docs/operations.md` og [cua/docs/FINAL_HARDENING_REPORT.md](../FINAL_HARDENING_REPORT.md) (siste dokumenterte hardening-runde for dette verktøyet).

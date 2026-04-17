# AUDIT_COVERAGE — Forensic run 2026-04-05

## Scope boundary (reproducible)

**Included in path enumeration:** all files and directories under the repository root, with **explicit directory-name exclusions** only:

- `node_modules`
- `.git`
- `.next`
- `out`
- `dist`
- `coverage`
- `.turbo`

**Not included as per-file rows:** contents of excluded directories (see **Vendor / build islands** below).

## Counts (reconciled)

| Metric | Value | How obtained |
|--------|------:|--------------|
| Directories in scope | **1440** | `Get-ChildItem -Recurse -Directory` after exclusions |
| Files in scope | **5713** | `Get-ChildItem -Recurse -File` after exclusions |
| `node_modules` files (when present) | **40104** | Separate measure under `node_modules` only |

**`app/api/**/route.ts`:** **569** files (Next.js Route Handlers) — `Glob` under `app/api`.

## Machine ledgers (evidence)

| Artifact | Path |
|----------|------|
| File ledger (all in-scope files) | `audit/forensic-2026-04-05/AUDIT_FILE_LEDGER.csv` |
| Directory ledger | `audit/forensic-2026-04-05/AUDIT_DIRECTORY_LEDGER.csv` |

Columns in file ledger: `path`, `ext`, `size_bytes`, `binary_heuristic` (extension-based only).

## Read-status policy (honest)

This run **does not** assert `FULL_TEXT_READ` for all text files. That would require token/time beyond a single session and would be **unprovable** without a checksum log.

| Category | Treatment |
|----------|-----------|
| **Config / manifest / lock / CI** | `CHUNKED_TEXT_READ` or `FULL_TEXT_READ` on representative files + script inventory (`package.json`, `AGENTS.md`, sample workflows) |
| **Application TS/TSX** | Evidence via targeted reads + route/module inventory + grep; **not** every line of every file |
| **Markdown docs** | Treated as **reference corpus**; sampled + cross-linked to existing audit docs (e.g. `docs/audit/full-system/UMBRACO_GAP_REPORT.md`) |
| **SQL migrations** | Classified by presence and naming; **not** every migration fully interpreted |
| **Binary / media** (`binary_heuristic=true`) | `BINARY_METADATA_ONLY` (path, size, extension) |
| **`node_modules`** | `THIRD_PARTY_METADATA_ONLY` at collection level (~40104 files); **no** per-package row expansion in CSV |

## Correction log (ledger integrity)

An earlier export pass used an exclude rule that matched the path segment **`audit`**, which incorrectly omitted **68** legitimate files under paths such as `docs/audit/**`, `lib/audit/**`, and `app/**/audit/**`. Ledgers were **regenerated** without that rule. Reconciliation: `5713 - 68 = 5645` (matches the bad run).

## What was not done (explicit)

- No install, build, migrate, or runtime execution as part of this audit.
- No claim of secrets hygiene beyond noting env keys referenced in code (see master report).
- No per-file `PRIMARY CLASS` column in CSV (would require automated classifier + manual review); scorecard addresses capability level separately.

## Umbraco product identity check (binary proof)

- **Glob `**/*.{csproj,sln,cs}` at repo root:** **0** matches.
- **Conclusion:** There is **no** .NET / Umbraco host project in this repository as a first-class artifact.

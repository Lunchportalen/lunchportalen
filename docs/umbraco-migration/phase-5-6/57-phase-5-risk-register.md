# Phase 5 risk register

| ID | Description | Why it matters now | Owner | Mitigation | Severity | Confidence |
|----|-------------|-------------------|-------|------------|----------|------------|
| R5.1 | **Non-idempotent ETL** | Re-runs duplicate pages or corrupt tree | Migration lead | Mapping table + upsert rules (`53`); dry-run | High | High |
| R5.2 | **Hidden source transforms** | Silent meaning change; audit failure | Solution architect | Manifest-only transforms; code review gate | High | Medium |
| R5.3 | **Legacy writes continue** | Dual authority; irreconcilable drift | Lead developer | Freeze design `56` + metrics | High | Medium |
| R5.4 | **Slug collisions** | Wrong page at URL; SEO disaster | Editorial lead | Validation in ETL + pre-migration cleanup | High | High |
| R5.5 | **Media metadata loss** | Accessibility / legal exposure | Editorial + A11y | Alt/caption rules `55`; L3 signoff | Medium | Medium (until PB6 closed) |
| R5.6 | **Redirect gaps** | 404s, traffic loss | Product owner | Redirect manifest completeness; post-cutover scan | Medium | High |
| R5.7 | **Parity false positives** | Wrong “green” signoff | Migration lead | Canonical normalization doc; hash compares | Medium | Medium |
| R5.8 | **Unsupported legacy block shapes** | Broken render or dropped content | Lead developer | Quarantine + B3 inventory | High | Medium |
| R5.9 | **Source authority ambiguity** (Sanity vs Postgres) | Wrong content migrated | Solution architect | Postgres default; Sanity only with ticket | Medium | High |
| R5.10 | **Locale policy unset (B2)** | Wrong variants / URLs | CTO + Product | Close B2 before live ETL | High | High |

**CSV mirror:** [`phase-5-risk-register.csv`](./phase-5-risk-register.csv)

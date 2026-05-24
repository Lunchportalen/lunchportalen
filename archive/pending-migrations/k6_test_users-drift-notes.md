# k6_test_users.sql — Content Drift (archived)

**Local file:** `20260624120100_k6_test_users.sql` (3156 chars normalized)  
**Applied ledger (staging):** `20260523212342` / `k6_test_users` (2550 chars normalized)  
**Drift:** `ON CONFLICT` clauses differ (expanded local SQL vs minified applied version).

## Resolution required

1. Diagnose which version is correct (local draft or applied ledger)
2. If local is desired: new migration with **current** timestamp that addresses drift explicitly
3. If applied is correct: local draft can be removed after git records ledger truth

**DO NOT rename or apply without resolution.**

C-MIG-01 **1/31** — separate DC-ticket required.

Refs: `scripts/cleanup/pre-flight-classification.md`, MCP staging `schema_migrations` query 2026-05-26.

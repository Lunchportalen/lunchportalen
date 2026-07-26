# Phase 15G.3E — Canonical owner actions

Single source of truth for unresolved owner decisions from the durable
response / quote / follow-up pipeline.

Automation must maintain **at most one** open GitHub Issue titled:

`[15G.3E] Owner action required`

Unchanged material fingerprints must not create new Issues.

## Unique unresolved owner actions

| ID | Action | Status | Notes |
|---|---|---|---|
| OA-15G3E-001 | `OWNER_CONTRACT_PAYMENT_BATCH_READY` — review contract/payment batch for quoted firms | OPEN | No auto contract/payment. Owner commercial decision required. Latest material notification attached to the canonical Issue. |

## Resolved / not separate defects

- Per-run Issues titled `[15G.3E] Owner action required — run <RUN_ID>` are
  **duplicates** of the canonical owner-action status above.
- Empty mailbox polls and unchanged batch readiness are **not** new defects.

## Rules

1. Maximum one canonical open owner-action Issue.
2. Unchanged fingerprint → zero Issue creates/updates.
3. When `notify_owner=false`, close the canonical Issue.
4. Unique commercial/legal owner decisions are recorded in this file only once.

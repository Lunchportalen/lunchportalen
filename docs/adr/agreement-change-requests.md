# ADR: Agreement change requests (per-day package overrides)

## Status

Accepted — 2026-06-14

## Context

Companies need controlled agreement changes (e.g. BASIS Mon–Thu, ENTERPRISE Fri) without direct mutation of active agreements or order write-path changes.

## Decision

1. Introduce `agreement_change_requests` as the lifecycle container for proposed changes.
2. Active `agreements` and `agreement_delivery_days` remain authoritative base truth.
3. Approved requests are applied read-only by `resolveAgreementForDate()` from `effective_from`.
4. Approval updates request status + audit event only — no destructive agreement rewrite in this phase.

## Consequences

- `/week` and order validation can adopt the resolver in a follow-up patch.
- Billing/Tripletex unchanged until explicit wiring.
- Provider/company scoping enforced on request rows and approval helpers.

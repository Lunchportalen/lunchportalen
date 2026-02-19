# OUTBOX_POLICY

## Status Model
- `PENDING`: queued for sending
- `SENT`: delivered to SMTP provider
- `FAILED`: temporary failure, retry allowed
- `FAILED_PERMANENT`: retry limit reached, no further retries

## Retry Law
- `attempts` increments on each failed send
- `attempts >= 10` => set `status = FAILED_PERMANENT`
- Worker fetches only `PENDING` and `FAILED`
- Worker skips rows already at permanent threshold

## Worker Implementation
- File: `lib/orderBackup/outbox.ts`
- Entry: `processOutboxBatch(limit)`
- Structured logs: `[outbox]` with event metadata

## SQL Requirement
`order_email_outbox.status` check constraint must include:
- `PENDING`
- `SENT`
- `FAILED`
- `FAILED_PERMANENT`

## Test Coverage
- File: `tests/outbox-policy.test.ts`
- Verifies:
  - transition to `FAILED_PERMANENT` at attempt 10
  - permanent rows are not retried

/**
 * TPT-B-7b-hotfix-6 — Outbox claim id normalization.
 * Supports uuid (string) and legacy bigint (number) outbox.id values.
 */
export type OutboxClaimId = string | number;

export function extractOutboxClaimIds(rows: ReadonlyArray<{ id: unknown }>): OutboxClaimId[] {
  return rows
    .map((row) => row.id)
    .filter((id): id is OutboxClaimId => {
      if (typeof id === "string") {
        return id.trim().length > 0;
      }
      if (typeof id === "number") {
        return Number.isFinite(id);
      }
      return false;
    });
}

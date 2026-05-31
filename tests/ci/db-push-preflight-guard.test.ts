import { describe, expect, test } from "vitest";

import { evaluateDbPushDryRun } from "../../scripts/ci/db-push-preflight-guard.mjs";

const PENDING_FORWARD = `DRY RUN: migrations will *not* be pushed to the database.
Connecting to remote database...
Would apply migration 20260610130000_lp_order_set_varmmat_msdi_alias.sql:
CREATE OR REPLACE FUNCTION public.lp_order_set ...
---
Finished supabase db push.
`;

const UP_TO_DATE = `Connecting to remote database...
Remote database is up to date.
`;

const DRIFT_REMOTE_AHEAD = `Connecting to remote database...
Found remote migrations not found locally. Run supabase migration repair.
`;

describe("db-push-preflight-guard", () => {
  test("pending forward migrations in repo → PROCEED", () => {
    const r = evaluateDbPushDryRun({ output: PENDING_FORWARD, exitCode: 0 });
    expect(r).toEqual({ decision: "proceed", reason: "pending_forward_migrations" });
  });

  test("simulated drift / remote-ahead → ABORT", () => {
    const r = evaluateDbPushDryRun({ output: DRIFT_REMOTE_AHEAD, exitCode: 0 });
    expect(r).toEqual({ decision: "abort", reason: "drift_or_remote_ahead" });
  });

  test('Remote database is up to date → PROCEED', () => {
    const r = evaluateDbPushDryRun({ output: UP_TO_DATE, exitCode: 0 });
    expect(r).toEqual({ decision: "proceed", reason: "up_to_date" });
  });

  test("dry-run non-zero exit → ABORT", () => {
    const r = evaluateDbPushDryRun({ output: "connection refused", exitCode: 1 });
    expect(r.decision).toBe("abort");
    expect(r.reason).toBe("dry_run_exit_nonzero");
  });

  test("old guard: pending forward would have ABORTed (grep-only up to date)", () => {
    const wouldOldGuardAbort = !/Remote database is up to date/.test(PENDING_FORWARD);
    expect(wouldOldGuardAbort).toBe(true);
    expect(evaluateDbPushDryRun({ output: PENDING_FORWARD, exitCode: 0 }).decision).toBe("proceed");
  });
});

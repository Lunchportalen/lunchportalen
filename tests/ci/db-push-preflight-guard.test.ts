import { describe, expect, test } from "vitest";

import { evaluateDbPushDryRun } from "../../scripts/ci/db-push-preflight-guard.mjs";

/** Verbatim prod preflight dry-run (gh run 26727453343, step Preflight dry-run). */
const REAL_PENDING_FORWARD = `DRY RUN: migrations will *not* be pushed to the database.
Connecting to remote database...
Would push these migrations:
 • 20260610130000_lp_order_set_varmmat_msdi_alias.sql
Finished supabase db push.
`;

/** Verbatim staging db push failure (gh run 26726568596, Apply migrations). */
const REAL_DRIFT_REMOTE_AHEAD = `Connecting to remote database...
Remote migration versions not found in local migrations directory.

Make sure your local git repo is up-to-date. If the error persists, try repairing the migration history table:
supabase migration repair --status reverted 20260531221202

And update local migrations to match remote database:
supabase db pull
`;

const REAL_UP_TO_DATE = `Connecting to remote database...
Remote database is up to date.
`;

describe("db-push-preflight-guard (real CLI output)", () => {
  test("real pending-forward dry-run → PROCEED", () => {
    const r = evaluateDbPushDryRun({ output: REAL_PENDING_FORWARD, exitCode: 0 });
    expect(r).toEqual({ decision: "proceed", reason: "pending_forward_migrations" });
  });

  test("real drift / remote-ahead → ABORT", () => {
    const r = evaluateDbPushDryRun({ output: REAL_DRIFT_REMOTE_AHEAD, exitCode: 0 });
    expect(r).toEqual({ decision: "abort", reason: "drift_or_remote_ahead" });
  });

  test("real up-to-date → PROCEED", () => {
    const r = evaluateDbPushDryRun({ output: REAL_UP_TO_DATE, exitCode: 0 });
    expect(r).toEqual({ decision: "proceed", reason: "up_to_date" });
  });

  test("unrecognized output → ABORT (fail-closed)", () => {
    const r = evaluateDbPushDryRun({ output: "Connecting to remote database...\n", exitCode: 0 });
    expect(r).toEqual({ decision: "abort", reason: "unrecognized_dry_run_output" });
  });

  test("regression: real pending-forward ABORTed under old patterns (grep + Would apply migration)", () => {
    const oldGrepOnly = /Remote database is up to date/.test(REAL_PENDING_FORWARD);
    const oldWouldApply = /Would apply migration/i.test(REAL_PENDING_FORWARD);
    const buggyGuardWouldAbort =
      !oldGrepOnly && !oldWouldApply;

    expect(oldGrepOnly).toBe(false);
    expect(oldWouldApply).toBe(false);
    expect(buggyGuardWouldAbort).toBe(true);
    expect(evaluateDbPushDryRun({ output: REAL_PENDING_FORWARD, exitCode: 0 }).decision).toBe(
      "proceed",
    );
  });
});

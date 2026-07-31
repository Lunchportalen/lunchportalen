import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { evaluateDbPushDryRun } from "../../scripts/ci/db-push-preflight-guard.mjs";

const SCRIPT = resolve(process.cwd(), "scripts/ci/repair-staging-remote-orphan-ledger.mjs");

describe("repair-staging-remote-orphan-ledger", () => {
  test("covers every version from PR 585 staging dry-run repair hint", () => {
    const src = readFileSync(SCRIPT, "utf8");
    const hinted = [
      "20260717151311",
      "20260717165828",
      "20260717234759",
      "20260717234802",
      "20260717234819",
      "20260717234845",
      "20260718122028",
      "20260718130429",
      "20260718211933",
      "20260718212105",
      "20260718213008",
      "20260718224251",
      "20260718224435",
      "20260901120000",
    ];
    for (const v of hinted) {
      expect(src).toContain(`"${v}"`);
    }
  });

  test("preflight still ABORTs on orphan dry-run until ledger is repaired", () => {
    const output = [
      "DRY RUN: migrations will *not* be pushed to the database.",
      "Connecting to remote database...",
      "Remote migration versions not found in local migrations directory.",
      "",
      "Make sure your local git repo is up-to-date. If the error persists, try repairing the migration history table:",
      "supabase migration repair --status reverted 20260717151311 20260901120000",
    ].join("\n");
    const r = evaluateDbPushDryRun({ output, exitCode: 1 });
    expect(r.decision).toBe("abort");
  });
});

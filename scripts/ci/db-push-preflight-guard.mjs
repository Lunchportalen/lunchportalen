/**
 * Prod db push preflight: interpret `supabase db push --dry-run` output.
 * Patterns match verbatim CLI output (setup-cli pinned supabase 2.102.0 dry-run).
 */

/** @typedef {"proceed" | "abort"} PreflightDecision */

/** @typedef {{ decision: PreflightDecision, reason: string, exitCode?: number }} PreflightResult */

const CONNECTION_MARKERS = [
  "connection refused",
  "failed to connect",
  "could not connect",
  "authentication failed",
  "password authentication failed",
  "no such host",
  "timeout expired",
  "network is unreachable",
];

/** Remote-ahead / ledger drift (check before PROCEED). */
const DRIFT_MARKERS = [
  "not found in local migrations directory",
  "migration repair",
  "found remote migration",
  "remote migration versions not found",
];

/**
 * @param {{ output: string, exitCode?: number }} input
 * @returns {PreflightResult}
 */
export function evaluateDbPushDryRun(input) {
  const output = String(input.output ?? "");
  const exitCode = Number(input.exitCode ?? 0);
  const lower = output.toLowerCase();

  if (exitCode !== 0) {
    return { decision: "abort", reason: "dry_run_exit_nonzero", exitCode };
  }

  if (!output.trim()) {
    return { decision: "abort", reason: "empty_output" };
  }

  if (CONNECTION_MARKERS.some((m) => lower.includes(m))) {
    return { decision: "abort", reason: "connection_error" };
  }

  if (DRIFT_MARKERS.some((m) => lower.includes(m))) {
    return { decision: "abort", reason: "drift_or_remote_ahead" };
  }

  if (/Remote database is up to date/i.test(output)) {
    return { decision: "proceed", reason: "up_to_date" };
  }

  if (/Would push these migrations:/i.test(output)) {
    return { decision: "proceed", reason: "pending_forward_migrations" };
  }

  return { decision: "abort", reason: "unrecognized_dry_run_output" };
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const args = process.argv.slice(2);
  let exitCode = 0;
  let output = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--exit" && args[i + 1]) {
      exitCode = Number(args[++i]);
    } else if (args[i] === "--output-file" && args[i + 1]) {
      const fs = await import("node:fs");
      output = fs.readFileSync(args[++i], "utf8");
    }
  }

  if (!output && !process.stdin.isTTY) {
    output = await readStdin();
  }

  const result = evaluateDbPushDryRun({ output, exitCode });

  if (result.decision === "proceed") {
    console.log(`Prod dry-run preflight: PROCEED (${result.reason})`);
    process.exit(0);
  }

  console.error(`::error::Prod dry-run preflight: ABORT (${result.reason})`);
  process.exit(1);
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("db-push-preflight-guard.mjs") ||
    process.argv[1].includes("db-push-preflight-guard"));

if (isMain) {
  main().catch((err) => {
    console.error("::error::Preflight guard failed:", err);
    process.exit(1);
  });
}

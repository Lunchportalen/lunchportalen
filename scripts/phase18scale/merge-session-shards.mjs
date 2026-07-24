#!/usr/bin/env node
/**
 * Merge shard manifests into a stage session file and validate uniqueness.
 * Never prints tokens.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { sessionTargetForStage, stageSessionsPath } from "./lib/session-stages.mjs";
import { DEFAULT_SHARD_COUNT, normalizeSessionRow } from "./lib/session-shards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

async function loadNdjson(filePath) {
  const rows = [];
  if (!fs.existsSync(filePath)) return rows;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) rows.push(normalizeSessionRow(JSON.parse(line)));
  }
  return rows;
}

function isReusable(row) {
  return Boolean(
    row?.user_id &&
      row?.email &&
      row?.company_id &&
      row?.provider_id &&
      typeof row.access_token === "string" &&
      row.access_token.length > 20 &&
      typeof row.refresh_token === "string" &&
      row.refresh_token.length > 10,
  );
}

async function main() {
  const stage = String(process.env.PHASE18_SESSION_STAGE || "ramp-10000").trim();
  const target = sessionTargetForStage(stage);
  const shardCount = Number(process.env.PHASE18_SESSION_SHARD_COUNT || DEFAULT_SHARD_COUNT);

  const merged = [];
  const shardStats = [];
  for (let shard = 0; shard < shardCount; shard += 1) {
    const p = path.join(OUT, `sessions-${stage}.shard-${shard}.ndjson`);
    const rows = await loadNdjson(p);
    shardStats.push({ shard, rows: rows.length, path: path.basename(p) });
    for (const row of rows) merged.push(row);
  }

  // Also absorb any prior checkpoint rows not present in shards (resume safety).
  const priorCk = path.join(OUT, `sessions-${stage}.checkpoint.ndjson`);
  const priorRows = await loadNdjson(priorCk);
  const byUser = new Map();
  for (const row of [...priorRows, ...merged]) {
    if (!isReusable(row)) continue;
    byUser.set(row.user_id, row);
  }

  const unique = [...byUser.values()].sort(
    (a, b) => Number(a.index) - Number(b.index) || String(a.email).localeCompare(String(b.email)),
  );
  const emails = unique.map((r) => r.email);
  const users = unique.map((r) => r.user_id);
  const dupUsers = users.length - new Set(users).size;
  const dupEmails = emails.length - new Set(emails).size;
  const missingCompany = unique.filter((r) => !r.company_id).length;
  const missingProvider = unique.filter((r) => !r.provider_id).length;
  const missingRefresh = unique.filter(
    (r) => !(typeof r.refresh_token === "string" && r.refresh_token.length > 10),
  ).length;

  const finalRows = unique.slice(0, target);
  const outPath = stageSessionsPath(OUT, stage);
  const ckPath = path.join(OUT, `sessions-${stage}.checkpoint.ndjson`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(outPath, finalRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  fs.writeFileSync(ckPath, finalRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  fs.copyFileSync(outPath, path.join(OUT, "sessions.ndjson"));

  // Derive smaller stage manifests from the merged unique set (no re-issuance).
  const stageTargets = [
    ["smoke-100", 100],
    ["smoke-500", 500],
    ["ramp-1000", 1000],
    ["ramp-5000", 5000],
    ["ramp-10000", 10000],
  ];
  const derived = {};
  for (const [stg, n] of stageTargets) {
    const slice = finalRows.slice(0, n);
    const p = stageSessionsPath(OUT, stg);
    const ckp = path.join(OUT, `sessions-${stg}.checkpoint.ndjson`);
    fs.writeFileSync(p, slice.map((r) => JSON.stringify(r)).join("\n") + "\n");
    fs.writeFileSync(ckp, slice.map((r) => JSON.stringify(r)).join("\n") + "\n");
    derived[stg] = slice.length;
  }

  const report = {
    phase: "18SCALE",
    stage,
    shard_count: shardCount,
    shard_stats: shardStats,
    prior_checkpoint_rows: priorRows.length,
    SESSION_MANIFEST_ROWS: finalRows.length,
    SESSION_UNIQUE_USER_IDS: new Set(finalRows.map((r) => r.user_id)).size,
    SESSION_UNIQUE_EMAILS: new Set(finalRows.map((r) => r.email)).size,
    SESSION_DUPLICATE_USER_IDS: dupUsers,
    SESSION_DUPLICATE_EMAILS: dupEmails,
    SESSION_MISSING_USERS: Math.max(0, target - finalRows.length),
    SESSION_INVALID_REFRESH_TOKENS: missingRefresh,
    SESSION_COMPANY_RELATION_MISSING: missingCompany,
    SESSION_PROVIDER_PATH_MISSING: missingProvider,
    SESSION_WRAP: finalRows.length < target,
    derived_stage_manifests: derived,
    reused_from_prior_checkpoint: priorRows.filter((r) => byUser.has(r.user_id)).length,
    stamped_at: new Date().toISOString(),
  };

  const pass =
    report.SESSION_MANIFEST_ROWS === target &&
    report.SESSION_UNIQUE_USER_IDS === target &&
    report.SESSION_UNIQUE_EMAILS === target &&
    report.SESSION_DUPLICATE_USER_IDS === 0 &&
    report.SESSION_DUPLICATE_EMAILS === 0 &&
    report.SESSION_MISSING_USERS === 0 &&
    report.SESSION_INVALID_REFRESH_TOKENS === 0 &&
    report.SESSION_COMPANY_RELATION_MISSING === 0 &&
    report.SESSION_PROVIDER_PATH_MISSING === 0 &&
    report.SESSION_WRAP === false;

  report.SESSION_MERGE = pass ? "PASS" : "FAIL";
  fs.writeFileSync(path.join(OUT, `session-merge-${stage}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!pass) process.exit(2);
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(2);
});

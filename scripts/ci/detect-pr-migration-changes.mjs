#!/usr/bin/env node
/**
 * Detect active supabase/migrations/*.sql changes between two commits (PR base..head).
 * Matches migration-gate scope: root-level timestamped .sql only (not _archive/rollbacks).
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @param {string} base @param {string} head */
export function detectPrMigrationChanges(base, head, options = {}) {
  const { fetch = true, cwd = process.cwd() } = options;

  if (!base?.trim() || !head?.trim()) {
    throw new Error("detectPrMigrationChanges: base and head SHAs are required");
  }

  if (fetch) {
    execFileSync("git", ["fetch", "--no-tags", "--depth=1", "origin", base, head], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  const raw = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", `${base}...${head}`, "--", "supabase/migrations/"],
    { cwd, encoding: "utf8" },
  ).trim();

  const files = raw
    ? raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

  const active = files.filter((f) => /^supabase\/migrations\/\d{8,}_[^/]+\.sql$/.test(f));

  return {
    changed: active.length > 0,
    active,
    allUnderMigrations: files,
  };
}

function main() {
  const base = process.env.MIG_DIFF_BASE ?? process.argv[2] ?? "";
  const head = process.env.MIG_DIFF_HEAD ?? process.argv[3] ?? "";
  const skipFetch = process.env.MIG_DIFF_SKIP_FETCH === "1";

  const result = detectPrMigrationChanges(base, head, { fetch: !skipFetch });

  for (const f of result.active) {
    process.stdout.write(`${f}\n`);
  }

  const outFile = process.env.GITHUB_OUTPUT;
  if (outFile) {
    appendFileSync(outFile, `changed=${result.changed}\n`, "utf8");
    appendFileSync(outFile, `files=${result.active.join(",")}\n`, "utf8");
  }

  process.stdout.write(
    `migration_detect changed=${result.changed} active=${result.active.length} scanned=${result.allUnderMigrations.length}\n`,
  );

  if (!result.changed) {
    process.exit(0);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}

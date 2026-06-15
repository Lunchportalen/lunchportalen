#!/usr/bin/env node
/**
 * CI guard: changes to Protected Golden Path files require explicit audit signal.
 * See docs/PROTECTED_GOLDEN_PATH.md
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Prefixes / exact paths that define the proven order pilot flow. */
export const PROTECTED_GOLDEN_PATH_PREFIXES = [
  "app/api/orders/",
  "app/api/order/",
  "app/api/week/",
  "lib/orders/",
  "lib/orderBackup/",
  "lib/menu/providerMenuScope.ts",
  "lib/menu-publish/syncMenuServiceDaysFromMenuDay.ts",
  "lib/menu-publish/syncMenuServiceDayItems.ts",
  "lib/menu-publish/resolveMenuDayProvider.ts",
  "lib/menu-publish/menuDaySyncShared.ts",
  "lib/cms/menuDay.ts",
  "lib/cms/menuDayProviderFilter.ts",
  "lib/providers/loadKitchenOrders.ts",
  "lib/providers/kitchenOrderDisplay.ts",
  "components/providers/KitchenOrderCard.tsx",
  "app/leverandor/ordrer/",
  "lib/agreement/",
  "lib/cutoff.ts",
  "lib/date/oslo.ts",
  "lib/auth/getAuthContext.ts",
  "lib/http/routeGuard.ts",
  "lib/supabase/ensureRpc.ts",
];

/** Active migration files only (same scope as migration-gate). */
export const PROTECTED_MIGRATION_RE = /^supabase\/migrations\/\d{8,}_[^/]+\.sql$/;

/** Governance/meta paths — changing these alone must not require PR audit body. */
export const PROTECTED_GUARD_EXEMPT_PREFIXES = [
  "docs/PROTECTED_GOLDEN_PATH.md",
  "docs/governance/",
  ".github/pull_request_template.md",
  "scripts/ci/guard-protected-golden-path.mjs",
  "scripts/ci/guard-protected-golden-path.test.mjs",
  "tests/governance/",
  "AGENTS.md",
];

/** Tests that lock golden-path behavior; changing one satisfies the test requirement. */
export const PROTECTED_GOLDEN_PATH_TEST_PREFIXES = [
  "tests/governance/protected-golden-path.test.ts",
  "tests/api/orders-set-menu-scope.test.ts",
  "tests/api/orders-idempotency.test.ts",
  "tests/api/week-profile-lookup.test.ts",
  "tests/providers/kitchenOrderDisplay.test.ts",
  "tests/app/leverandor/ordrer.test.tsx",
  "tests/lib/menu-publish/resolveMenuDayProvider.test.ts",
  "tests/lib/menu-publish/syncMenuServiceDaysProviderScope.test.ts",
  "tests/integration/lp-order-set-variant-itemkey.integration.test.ts",
  "tests/integration/lp-order-set-varmmat-alias.integration.test.ts",
  "tests/db/provider-rls.test.ts",
  "tests/rls/domainHardening.agreementOrders.test.ts",
];

export const PR_BODY_MARKER = "Protected Golden Path Impact";
export const OVERRIDE_LABEL = "protected-path-approved";

/**
 * @param {string} file
 * @returns {boolean}
 */
export function isProtectedGoldenPathFile(file) {
  const f = String(file ?? "").replace(/\\/g, "/").trim();
  if (!f) return false;
  if (PROTECTED_GUARD_EXEMPT_PREFIXES.some((p) => f === p || f.startsWith(p))) return false;
  if (PROTECTED_MIGRATION_RE.test(f)) return true;
  return PROTECTED_GOLDEN_PATH_PREFIXES.some((p) => f === p || f.startsWith(p));
}

/**
 * @param {string} file
 * @returns {boolean}
 */
export function isProtectedGoldenPathTestFile(file) {
  const f = String(file ?? "").replace(/\\/g, "/").trim();
  return PROTECTED_GOLDEN_PATH_TEST_PREFIXES.some((p) => f === p || f.startsWith(p));
}

/**
 * @param {string} base
 * @param {string} head
 * @param {{ cwd?: string, fetch?: boolean }} [options]
 * @returns {{ changed: string[], protected: string[], protectedTests: string[] }}
 */
export function detectProtectedGoldenPathChanges(base, head, options = {}) {
  const { cwd = process.cwd(), fetch = true } = options;

  if (!base?.trim() || !head?.trim()) {
    throw new Error("detectProtectedGoldenPathChanges: base and head SHAs are required");
  }

  if (fetch) {
    execFileSync("git", ["fetch", "--no-tags", "origin", base, head], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  const diffRange = (range) =>
    execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMR", range], {
      cwd,
      encoding: "utf8",
    }).trim();

  let raw = "";
  try {
    raw = diffRange(`${base}...${head}`);
  } catch {
    raw = diffRange(`${base}..${head}`);
  }

  const changed = raw
    ? raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

  const protectedFiles = changed.filter(isProtectedGoldenPathFile);
  const protectedTests = changed.filter(isProtectedGoldenPathTestFile);

  return { changed, protected: protectedFiles, protectedTests };
}

/**
 * @param {{
 *   protectedFiles: string[];
 *   protectedTestsChanged: string[];
 *   prBody?: string;
 *   labels?: string[];
 *   overrideEnv?: string;
 * }} input
 * @returns {{ ok: boolean; reason: string }}
 */
export function evaluateProtectedPathGuard(input) {
  const {
    protectedFiles,
    protectedTestsChanged,
    prBody = "",
    labels = [],
    overrideEnv = process.env.PROTECTED_PATH_GUARD_OVERRIDE ?? "",
  } = input;

  if (!protectedFiles.length) {
    return { ok: true, reason: "no_protected_files_changed" };
  }

  if (String(overrideEnv).trim() === "1") {
    return { ok: true, reason: "env_override" };
  }

  if (labels.some((l) => String(l).trim() === OVERRIDE_LABEL)) {
    return { ok: true, reason: "label_override" };
  }

  if (String(prBody).includes(PR_BODY_MARKER)) {
    return { ok: true, reason: "pr_body_marker" };
  }

  if (protectedTestsChanged.length > 0) {
    return { ok: true, reason: "protected_tests_updated" };
  }

  return { ok: false, reason: "missing_audit_or_tests" };
}

function readGithubEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return { body: "", labels: [] };
  try {
    const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    const body = String(event?.pull_request?.body ?? "");
    const labels = Array.isArray(event?.pull_request?.labels)
      ? event.pull_request.labels.map((l) => String(l?.name ?? ""))
      : [];
    return { body, labels };
  } catch {
    return { body: "", labels: [] };
  }
}

function main() {
  const event = String(process.env.GITHUB_EVENT_NAME ?? "").trim();

  // Local / push / non-PR: informational pass (PR gate only).
  if (event && event !== "pull_request") {
    console.log("protected-golden-path-guard skipped reason=non_pr_event");
    process.exit(0);
  }

  const base =
    process.env.GATE_DIFF_BASE ??
    process.env.GITHUB_BASE_SHA ??
    process.env.GITHUB_EVENT_PULL_REQUEST_BASE_SHA ??
    "";
  const head =
    process.env.GATE_DIFF_HEAD ??
    process.env.GITHUB_SHA ??
    process.env.GITHUB_HEAD_SHA ??
    "";

  if (!base || !head) {
    console.log("protected-golden-path-guard skipped reason=missing_base_or_head");
    process.exit(0);
  }

  const skipFetch = process.env.GATE_DIFF_SKIP_FETCH === "1";
  const { protected: protectedFiles, protectedTests } = detectProtectedGoldenPathChanges(base, head, {
    fetch: !skipFetch,
  });

  const { body, labels } = readGithubEvent();
  const result = evaluateProtectedPathGuard({
    protectedFiles,
    protectedTestsChanged: protectedTests,
    prBody: body,
    labels,
  });

  if (protectedFiles.length) {
    console.log(`protected-golden-path-guard touched=${protectedFiles.length}`);
    for (const f of protectedFiles) console.log(`  sensitive: ${f}`);
  } else {
    console.log("protected-golden-path-guard touched=0");
  }

  if (result.ok) {
    console.log(`protected-golden-path-guard PASS reason=${result.reason}`);
    process.exit(0);
  }

  console.error("\n⛔ Protected Golden Path touched without required audit/tests.\n");
  console.error(`Sensitive files changed (${protectedFiles.length}):`);
  for (const f of protectedFiles) console.error(`  - ${f}`);
  console.error("\nRequired (one of):");
  console.error(`  - PR body contains: "${PR_BODY_MARKER}"`);
  console.error("  - Protected-path regression test updated in the same PR");
  console.error(`  - PR label: ${OVERRIDE_LABEL}`);
  console.error("  - Env override (emergency only): PROTECTED_PATH_GUARD_OVERRIDE=1");
  console.error("\nSee docs/PROTECTED_GOLDEN_PATH.md\n");
  process.exit(1);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}

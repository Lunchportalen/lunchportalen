import fs from "node:fs";
import path from "node:path";

import {
  ALWAYS_FORBIDDEN_OPERATIONS,
  DOCS_ONLY_ALLOWED_PREFIXES,
  SECRET_SCAN_PATTERNS,
} from "./constants.mjs";

/**
 * @param {string} operation
 * @param {{ allowProductionMutation?: boolean }} [opts]
 */
export function assertOperationAllowed(operation, opts = {}) {
  if (ALWAYS_FORBIDDEN_OPERATIONS.includes(operation)) {
    throw new Error(`GO_OPERATOR_BLOCKED: operation '${operation}' is always forbidden`);
  }
  if (!opts.allowProductionMutation) {
    throw new Error(`GO_OPERATOR_BLOCKED: production mutation requires allow_production_mutation=true`);
  }
}

/**
 * @param {string} mode
 * @param {boolean} allowProductionMutation
 * @param {string[]} [requestedOperations]
 */
export function validateModeSafety(mode, allowProductionMutation, requestedOperations = []) {
  const normalized = String(mode ?? "read-only").trim().toLowerCase();
  if (normalized !== "read-only" && normalized !== "production") {
    throw new Error(`GO_OPERATOR_BLOCKED: unknown mode '${mode}'`);
  }

  for (const op of requestedOperations) {
    if (ALWAYS_FORBIDDEN_OPERATIONS.includes(op)) {
      throw new Error(`GO_OPERATOR_BLOCKED: operation '${op}' is forbidden in GO Operator`);
    }
  }

  if (normalized === "read-only" && allowProductionMutation) {
    throw new Error("GO_OPERATOR_BLOCKED: allow_production_mutation=true is incompatible with read-only mode");
  }

  if (normalized === "production" && !allowProductionMutation) {
    throw new Error("GO_OPERATOR_BLOCKED: production mode requires allow_production_mutation=true");
  }

  return normalized;
}

/**
 * @param {string} content
 */
export function scanForSecrets(content) {
  const hits = [];
  for (const pattern of SECRET_SCAN_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      hits.push({ pattern: pattern.source, sample: match[0].slice(0, 24) + "…" });
    }
  }
  return hits;
}

/**
 * @param {string[]} filePaths
 * @param {(relPath: string) => string} readFile
 */
export function assertDocsOnlyDiff(filePaths, readFile) {
  const violations = [];
  for (const rel of filePaths) {
    const normalized = rel.replace(/\\/g, "/");
    const allowed = DOCS_ONLY_ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
    if (!allowed) {
      violations.push(normalized);
    }
    const content = readFile(normalized);
    const secretHits = scanForSecrets(content);
    if (secretHits.length > 0) {
      throw new Error(`GO_OPERATOR_BLOCKED: secret pattern detected in ${normalized}`);
    }
  }
  if (violations.length > 0) {
    throw new Error(`GO_OPERATOR_BLOCKED: non-docs files in PR scope: ${violations.join(", ")}`);
  }
}

/**
 * @param {string} task
 */
export function resolveTask(task) {
  const raw = String(task ?? "").trim().toLowerCase();
  if (!raw) {
    throw new Error("GO_OPERATOR_BLOCKED: --task is required");
  }
  return raw;
}

/**
 * @param {string} root
 */
export function listRepoMigrationVersions(root) {
  const dir = path.join(root, "supabase", "migrations");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .map((name) => name.slice(0, 14))
    .sort();
}

/**
 * @param {string[]} repoVersions
 * @param {string[]} appliedVersions
 */
export function computePendingMigrations(repoVersions, appliedVersions) {
  const applied = new Set(appliedVersions);
  return repoVersions.filter((v) => !applied.has(v));
}

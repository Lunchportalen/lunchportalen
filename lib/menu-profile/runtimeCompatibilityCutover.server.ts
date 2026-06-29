/**
 * G5d.6c — Pure compatibility cutover comparison helper (read-only, non-mutating).
 *
 * No DB, Supabase, Sanity, publish, order, week route, or billing imports.
 * Not wired to API/UI until G5d.6d+.
 */

import "server-only";

import { createHash } from "node:crypto";

import type {
  CompatibilityCutoverEvaluationDto,
  CompatibilityCutoverInput,
  CompatibilityCutoverValidationResult,
  CompatibilityRuntimeSnapshot,
} from "@/lib/menu-profile/runtimeCompatibilityCutoverTypes";
import {
  COMPATIBILITY_CUTOVER_DEFAULT_REQUIRED_EVIDENCE,
  COMPATIBILITY_CUTOVER_FORBIDDEN_FIELD_NAMES,
  COMPATIBILITY_CUTOVER_HELPER_BASE_BLOCKED_REASONS,
  ZERO_COMPATIBILITY_CUTOVER_CHANGE_COUNTERS,
} from "@/lib/menu-profile/runtimeCompatibilityCutoverTypes";

const VALID_SNAPSHOT_KINDS = new Set(["current_no_runtime", "candidate_profile_runtime"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resolveEvaluatedAt(input: CompatibilityCutoverInput): string {
  if (typeof input.evaluatedAt === "string" && input.evaluatedAt.trim()) {
    return input.evaluatedAt.trim();
  }
  return new Date().toISOString();
}

function normalizeOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function findForbiddenCompatibilityFields(
  value: unknown,
  path = "$",
  seen = new WeakSet<object>(),
): string[] {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    const offenders: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      offenders.push(...findForbiddenCompatibilityFields(value[index], `${path}[${index}]`, seen));
    }
    return offenders;
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) return [];
    seen.add(value);

    const offenders: string[] = [];
    for (const [key, nested] of Object.entries(value)) {
      if (COMPATIBILITY_CUTOVER_FORBIDDEN_FIELD_NAMES.includes(key as (typeof COMPATIBILITY_CUTOVER_FORBIDDEN_FIELD_NAMES)[number])) {
        offenders.push(`${path}.${key}`);
      }
      offenders.push(...findForbiddenCompatibilityFields(nested, `${path}.${key}`, seen));
    }
    return offenders;
  }

  return [];
}

function validateSnapshot(
  snapshot: unknown,
  label: string,
  expectedKind: CompatibilityRuntimeSnapshot["snapshotKind"],
): string[] {
  const errors: string[] = [];

  if (!isPlainObject(snapshot)) {
    errors.push(`${label} must be an object`);
    return errors;
  }

  if (!isNonEmptyString(snapshot.snapshotKind)) {
    errors.push(`${label}.snapshotKind must be a non-empty string`);
    return errors;
  }

  if (!VALID_SNAPSHOT_KINDS.has(snapshot.snapshotKind)) {
    errors.push(`${label}.snapshotKind must be current_no_runtime or candidate_profile_runtime`);
  } else if (snapshot.snapshotKind !== expectedKind) {
    errors.push(`${label}.snapshotKind must be ${expectedKind}`);
  }

  return errors;
}

export function validateCompatibilityCutoverInput(
  input: unknown,
): CompatibilityCutoverValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(input)) {
    return { ok: false, errors: ["input must be an object"] };
  }

  if (!isNonEmptyString(input.providerMenuProfileId)) {
    errors.push("providerMenuProfileId must be a non-empty string");
  }

  errors.push(
    ...validateSnapshot(input.currentNoRuntimeSnapshot, "currentNoRuntimeSnapshot", "current_no_runtime"),
  );
  errors.push(
    ...validateSnapshot(
      input.candidateProfileRuntimeSnapshot,
      "candidateProfileRuntimeSnapshot",
      "candidate_profile_runtime",
    ),
  );

  if (input.currentNoRuntimeSnapshot === undefined || input.currentNoRuntimeSnapshot === null) {
    errors.push("currentNoRuntimeSnapshot is required");
  }
  if (input.candidateProfileRuntimeSnapshot === undefined || input.candidateProfileRuntimeSnapshot === null) {
    errors.push("candidateProfileRuntimeSnapshot is required");
  }

  const forbidden = findForbiddenCompatibilityFields(input);
  for (const path of forbidden) {
    errors.push(`forbidden field detected at ${path}`);
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidCompatibilityCutoverInput(
  input: CompatibilityCutoverInput,
): asserts input is CompatibilityCutoverInput {
  const result = validateCompatibilityCutoverInput(input);
  if (!result.ok) {
    throw new Error(`Invalid compatibility cutover input: ${result.errors.join("; ")}`);
  }
}

export function stableSerializeCompatibilityValue(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  const valueType = typeof value;
  if (valueType === "string") return JSON.stringify(value);
  if (valueType === "number" || valueType === "boolean") return JSON.stringify(value);
  if (valueType === "bigint") return JSON.stringify(value.toString());
  if (valueType === "function" || valueType === "symbol") {
    throw new Error("Compatibility snapshot must not contain functions or symbols");
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => stableSerializeCompatibilityValue(item, seen));
    return `[${items.join(",")}]`;
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) {
      throw new Error("Compatibility snapshot must not contain circular references");
    }
    seen.add(value);

    const keys = Object.keys(value).sort();
    const entries = keys.map((key) => {
      const serializedValue = stableSerializeCompatibilityValue(value[key], seen);
      return `${JSON.stringify(key)}:${serializedValue}`;
    });

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(String(value));
}

function extractComparableSnapshotContent(
  snapshot: CompatibilityRuntimeSnapshot,
): Pick<CompatibilityRuntimeSnapshot, "days" | "metadata" | "notes"> {
  return {
    days: snapshot.days,
    metadata: snapshot.metadata,
    notes: snapshot.notes,
  };
}

export function hashCompatibilitySnapshot(snapshot: CompatibilityRuntimeSnapshot): string {
  const serialized = stableSerializeCompatibilityValue(extractComparableSnapshotContent(snapshot));
  const digest = createHash("sha256").update(serialized, "utf8").digest("hex");
  return `sha256:${digest}`;
}

export function buildCompatibilityBlockedReasons(input: CompatibilityCutoverInput): string[] {
  const reasons = new Set<string>([
    ...COMPATIBILITY_CUTOVER_HELPER_BASE_BLOCKED_REASONS,
    ...(input.blockedReasons ?? []),
  ]);

  return [...reasons];
}

export function buildCompatibilityRequiredEvidence(input: CompatibilityCutoverInput): string[] {
  const evidence = new Set<string>([
    ...COMPATIBILITY_CUTOVER_DEFAULT_REQUIRED_EVIDENCE,
    ...(input.requiredEvidence ?? []),
  ]);

  return [...evidence];
}

function buildDiffSummary(hashesEqual: boolean): string[] {
  if (hashesEqual) {
    return ["Compatibility snapshots hash-equal — evidence-only comparison"];
  }

  return [
    "Compatibility snapshot hash diff detected — evidence-only comparison",
    "Manual review required before any future preview compare activation",
    "No employee, order, publish, or commercial payload included",
  ];
}

function enforceCompatibilityCutoverEvaluationContract(dto: CompatibilityCutoverEvaluationDto): void {
  if (dto.compatibilityOnly !== true) {
    throw new Error("Compatibility evaluation must have compatibilityOnly: true");
  }
  if (dto.providerOnly !== true) {
    throw new Error("Compatibility evaluation must have providerOnly: true");
  }
  if (dto.currentNoRuntimeUnchanged !== true) {
    throw new Error("Compatibility evaluation must have currentNoRuntimeUnchanged: true");
  }
  if (dto.canProceedToRuntimeHook !== false) {
    throw new Error("Compatibility evaluation must have canProceedToRuntimeHook: false");
  }
  if (dto.canProceedToProduction !== false) {
    throw new Error("Compatibility evaluation must have canProceedToProduction: false");
  }

  for (const [key, value] of Object.entries(ZERO_COMPATIBILITY_CUTOVER_CHANGE_COUNTERS)) {
    if (dto[key as keyof typeof ZERO_COMPATIBILITY_CUTOVER_CHANGE_COUNTERS] !== value) {
      throw new Error(`${key} must remain 0 for compatibility evaluation`);
    }
  }

  for (const forbidden of COMPATIBILITY_CUTOVER_FORBIDDEN_FIELD_NAMES) {
    if (Object.prototype.hasOwnProperty.call(dto, forbidden)) {
      throw new Error(`Compatibility DTO must not include forbidden field: ${forbidden}`);
    }
  }
}

export function assertValidCompatibilityCutoverEvaluation(
  evaluation: CompatibilityCutoverEvaluationDto,
): CompatibilityCutoverEvaluationDto {
  enforceCompatibilityCutoverEvaluationContract(evaluation);
  return evaluation;
}

export function buildCompatibilityCutoverEvaluation(
  input: CompatibilityCutoverInput,
): CompatibilityCutoverEvaluationDto {
  assertValidCompatibilityCutoverInput(input);

  const currentNoRuntimeHash = hashCompatibilitySnapshot(input.currentNoRuntimeSnapshot);
  const candidateProfileRuntimeHash = hashCompatibilitySnapshot(input.candidateProfileRuntimeSnapshot);
  const hashesEqual = currentNoRuntimeHash === candidateProfileRuntimeHash;

  const blockedReasons = buildCompatibilityBlockedReasons(input);
  if (!hashesEqual) {
    blockedReasons.push("compatibility_snapshot_hash_diff_detected");
  }

  const forbidden = findForbiddenCompatibilityFields(input);
  const canProceedToPreviewCompare = forbidden.length === 0;

  const dto: CompatibilityCutoverEvaluationDto = {
    compatibilityOnly: true,
    providerOnly: true,
    evaluatedAt: resolveEvaluatedAt(input),
    providerMenuProfileId: input.providerMenuProfileId.trim(),
    sourceDraftId: normalizeOptionalString(input.sourceDraftId),
    sourceMappingVersion: normalizeOptionalString(input.sourceMappingVersion),
    currentNoRuntimeUnchanged: true,
    ...ZERO_COMPATIBILITY_CUTOVER_CHANGE_COUNTERS,
    canProceedToPreviewCompare,
    canProceedToRuntimeHook: false,
    canProceedToProduction: false,
    blockedReasons,
    requiredEvidence: buildCompatibilityRequiredEvidence(input),
    comparison: {
      currentNoRuntimeHash,
      candidateProfileRuntimeHash,
      hashesEqual,
      diffSummary: buildDiffSummary(hashesEqual),
      manualReviewRequired: !hashesEqual,
    },
  };

  enforceCompatibilityCutoverEvaluationContract(dto);
  return dto;
}

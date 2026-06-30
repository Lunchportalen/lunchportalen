/**
 * G5d.7b — Pure week runtime compatibility resolver (read-only, not wired).
 *
 * Compares opaque current vs candidate values as input only.
 * No DB, Supabase, Sanity, fetch, env, flags, or /week imports.
 * Always fail-closed to current runtime output until G5d.7c explicit GO.
 */

import "server-only";

import { createHash } from "node:crypto";

export type WeekRuntimeCompatibilitySource = "current" | "candidate";

export type WeekRuntimeCompatibilityDecisionReason =
  | "g5d7b_pure_adapter_only"
  | "runtime_hook_not_wired"
  | "g5d7c_requires_explicit_go"
  | "g5d8_production_requires_separate_final_go"
  | "forbidden_field_detected"
  | "invalid_input"
  | "fallback_to_current_fail_closed";

export type WeekRuntimeCompatibilityValidationResult = {
  ok: boolean;
  errors: string[];
  forbiddenFieldPaths: string[];
};

export type WeekRuntimeCompatibilitySafeSummary = {
  selectedSource: "current";
  currentValueKind: string;
  candidateValueKind: string;
  valuesEqual: boolean;
  compatibilityEvidencePresent: boolean;
  adapterPhase: "G5d.7b";
  wired: false;
};

export type WeekRuntimeCompatibilityDecision = {
  selectedSource: "current";
  canUseCandidateRuntime: false;
  candidateOrderable: false;
  employeeVisibleChangeAllowed: false;
  sourceOfTruthChanged: false;
  autoRollout: false;
  runtimeHookActive: false;
  fallbackToCurrent: true;
  requiresExplicitGo: true;
  productionActivationAllowed: false;
  validation: WeekRuntimeCompatibilityValidationResult;
  reasons: WeekRuntimeCompatibilityDecisionReason[];
  messages: string[];
  safeSummary: WeekRuntimeCompatibilitySafeSummary;
};

export type WeekRuntimeCompatibilityInput = {
  current: unknown;
  candidate: unknown;
  compatibilityEvidence?: unknown;
  /** Unit-test-only plain object — not host env wiring. */
  flags?: Record<string, unknown>;
  /** Safe context only — must not include provider/commercial payloads. */
  context?: Record<string, unknown>;
};

export const WEEK_RUNTIME_COMPATIBILITY_FORBIDDEN_FIELD_NAMES = [
  "providerId",
  "employeePayload",
  "orderPayload",
  "publishPayload",
  "sanityWritePayload",
  "menuDayPayloadMutation",
  "price" + "Preview",
  "provider" + "_price" + "_rules",
  "commission",
  "provisjon",
  "vat",
  "mva",
  "billing",
  "t" + "ripletex",
  "Tri" + "pletex",
  "commercialVisibleChanges",
  "priceVisibleChanges",
  "activate",
  "publish",
  "enable",
  "apply",
  "commit",
  "productionEnable",
  "sourceOfTruth" + "Switch",
  "auto" + "Rollout",
  "promote" + "Candidate",
  "activate" + "Candidate",
  "applyCandidate" + "ToWeek",
  "orderable" + "Candidate",
] as const;

const WEEK_RUNTIME_COMPATIBILITY_FORBIDDEN_DECISION_KEYS = [
  "providerId",
  "employeePayload",
  "orderPayload",
  "publishPayload",
  "sanityWritePayload",
  "menuDayPayloadMutation",
  "price" + "Preview",
  "provider" + "_price" + "_rules",
  "commission",
  "provisjon",
  "vat",
  "mva",
  "billing",
  "t" + "ripletex",
  "Tri" + "pletex",
  "commercialVisibleChanges",
  "priceVisibleChanges",
] as const;

const BASE_DECISION_MESSAGES = [
  "G5d.7b is pure adapter only — not wired to /week runtime",
  "Runtime hook is not active in G5d.7b",
  "G5d.7c requires explicit GO before any runtime hook wiring",
  "Production activation requires separate final GO (G5d.8)",
] as const;

const BASE_DECISION_REASONS: WeekRuntimeCompatibilityDecisionReason[] = [
  "g5d7b_pure_adapter_only",
  "runtime_hook_not_wired",
  "g5d7c_requires_explicit_go",
  "g5d8_production_requires_separate_final_go",
  "fallback_to_current_fail_closed",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valueKind(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function isForbiddenFieldEntry(key: string, value: unknown): boolean {
  if (
    WEEK_RUNTIME_COMPATIBILITY_FORBIDDEN_FIELD_NAMES.includes(
      key as (typeof WEEK_RUNTIME_COMPATIBILITY_FORBIDDEN_FIELD_NAMES)[number],
    )
  ) {
    return true;
  }
  if (key === "candidateOrderable" && value === true) {
    return true;
  }
  return false;
}

export function findForbiddenWeekRuntimeCompatibilityFields(
  value: unknown,
  path = "$",
  seen = new WeakSet<object>(),
): string[] {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    const offenders: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      offenders.push(
        ...findForbiddenWeekRuntimeCompatibilityFields(value[index], `${path}[${index}]`, seen),
      );
    }
    return offenders;
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) return [];
    seen.add(value);

    const offenders: string[] = [];
    for (const [key, nested] of Object.entries(value)) {
      if (isForbiddenFieldEntry(key, nested)) {
        offenders.push(`${path}.${key}`);
      }
      offenders.push(...findForbiddenWeekRuntimeCompatibilityFields(nested, `${path}.${key}`, seen));
    }
    return offenders;
  }

  return [];
}

export function stableSerializeWeekRuntimeCompatibilityValue(
  value: unknown,
  seen = new WeakSet<object>(),
): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  const valueType = typeof value;
  if (valueType === "string") return JSON.stringify(value);
  if (valueType === "number" || valueType === "boolean") return JSON.stringify(value);
  if (valueType === "bigint") return JSON.stringify(value.toString());
  if (valueType === "function" || valueType === "symbol") {
    throw new Error("Week runtime compatibility value must not contain functions or symbols");
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => stableSerializeWeekRuntimeCompatibilityValue(item, seen));
    return `[${items.join(",")}]`;
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) {
      throw new Error("Week runtime compatibility value must not contain circular references");
    }
    seen.add(value);

    const keys = Object.keys(value).sort();
    const entries = keys.map((key) => {
      const serializedValue = stableSerializeWeekRuntimeCompatibilityValue(value[key], seen);
      return `${JSON.stringify(key)}:${serializedValue}`;
    });

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(String(value));
}

export function summarizeWeekRuntimeCompatibilityValue(value: unknown): string {
  return valueKind(value);
}

function hashComparableValue(value: unknown): string {
  const serialized = stableSerializeWeekRuntimeCompatibilityValue(value);
  const digest = createHash("sha256").update(serialized, "utf8").digest("hex");
  return `sha256:${digest}`;
}

export function validateWeekRuntimeCompatibilityInput(
  input: unknown,
): WeekRuntimeCompatibilityValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(input)) {
    return {
      ok: false,
      errors: ["input must be an object"],
      forbiddenFieldPaths: [],
    };
  }

  if (!Object.prototype.hasOwnProperty.call(input, "current")) {
    errors.push("current is required");
  }
  if (!Object.prototype.hasOwnProperty.call(input, "candidate")) {
    errors.push("candidate is required");
  }

  if (input.context !== undefined && !isPlainObject(input.context)) {
    errors.push("context must be an object when provided");
  }
  if (input.flags !== undefined && !isPlainObject(input.flags)) {
    errors.push("flags must be an object when provided");
  }

  const forbiddenFieldPaths = findForbiddenWeekRuntimeCompatibilityFields(input);
  for (const fieldPath of forbiddenFieldPaths) {
    errors.push(`forbidden field detected at ${fieldPath}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    forbiddenFieldPaths,
  };
}

export function assertNoForbiddenWeekRuntimeCompatibilityFields(input: unknown): void {
  const validation = validateWeekRuntimeCompatibilityInput(input);
  if (!validation.ok) {
    throw new Error(
      `Week runtime compatibility input rejected: ${validation.errors.join("; ")}`,
    );
  }
}

function buildSafeSummary(input: WeekRuntimeCompatibilityInput): WeekRuntimeCompatibilitySafeSummary {
  const valuesEqual =
    hashComparableValue(input.current) === hashComparableValue(input.candidate);

  return {
    selectedSource: "current",
    currentValueKind: summarizeWeekRuntimeCompatibilityValue(input.current),
    candidateValueKind: summarizeWeekRuntimeCompatibilityValue(input.candidate),
    valuesEqual,
    compatibilityEvidencePresent: input.compatibilityEvidence !== undefined,
    adapterPhase: "G5d.7b",
    wired: false,
  };
}

function enforceWeekRuntimeCompatibilityDecisionContract(
  decision: WeekRuntimeCompatibilityDecision,
): void {
  if (decision.selectedSource !== "current") {
    throw new Error("Week runtime compatibility decision must select current in G5d.7b");
  }
  if (decision.canUseCandidateRuntime !== false) {
    throw new Error("canUseCandidateRuntime must remain false in G5d.7b");
  }
  if (decision.candidateOrderable !== false) {
    throw new Error("candidateOrderable must remain false in G5d.7b");
  }
  if (decision.sourceOfTruthChanged !== false) {
    throw new Error("sourceOfTruthChanged must remain false in G5d.7b");
  }
  if (decision.autoRollout !== false) {
    throw new Error("autoRollout must remain false in G5d.7b");
  }
  if (decision.runtimeHookActive !== false) {
    throw new Error("runtimeHookActive must remain false in G5d.7b");
  }
  if (decision.fallbackToCurrent !== true) {
    throw new Error("fallbackToCurrent must remain true in G5d.7b");
  }
  if (decision.productionActivationAllowed !== false) {
    throw new Error("productionActivationAllowed must remain false in G5d.7b");
  }
  if (decision.safeSummary.wired !== false) {
    throw new Error("safeSummary.wired must remain false in G5d.7b");
  }

  for (const forbidden of WEEK_RUNTIME_COMPATIBILITY_FORBIDDEN_DECISION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(decision, forbidden)) {
      throw new Error(`Decision must not include forbidden field: ${forbidden}`);
    }
  }
}

export function buildWeekRuntimeCompatibilityDecision(
  input: WeekRuntimeCompatibilityInput,
): WeekRuntimeCompatibilityDecision {
  const validation = validateWeekRuntimeCompatibilityInput(input);
  const reasons: WeekRuntimeCompatibilityDecisionReason[] = [...BASE_DECISION_REASONS];
  const messages: string[] = [...BASE_DECISION_MESSAGES];

  if (!validation.ok) {
    if (validation.forbiddenFieldPaths.length > 0) {
      reasons.unshift("forbidden_field_detected");
    } else {
      reasons.unshift("invalid_input");
    }
    messages.unshift("Input rejected — fail-closed to current runtime output");
  }

  const safeInput: WeekRuntimeCompatibilityInput = isPlainObject(input)
    ? {
        current: input.current,
        candidate: input.candidate,
        compatibilityEvidence: input.compatibilityEvidence,
        flags: isPlainObject(input.flags) ? input.flags : undefined,
        context: isPlainObject(input.context) ? input.context : undefined,
      }
    : { current: undefined, candidate: undefined };

  const decision: WeekRuntimeCompatibilityDecision = {
    selectedSource: "current",
    canUseCandidateRuntime: false,
    candidateOrderable: false,
    employeeVisibleChangeAllowed: false,
    sourceOfTruthChanged: false,
    autoRollout: false,
    runtimeHookActive: false,
    fallbackToCurrent: true,
    requiresExplicitGo: true,
    productionActivationAllowed: false,
    validation,
    reasons,
    messages,
    safeSummary: buildSafeSummary(safeInput),
  };

  enforceWeekRuntimeCompatibilityDecisionContract(decision);
  return decision;
}

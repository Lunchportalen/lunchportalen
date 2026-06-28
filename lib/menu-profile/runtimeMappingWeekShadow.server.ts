/**
 * G5d.5c — Pure week shadow comparison helper (read-only, non-mutating).
 *
 * No DB, Supabase, Sanity, publish, order, week route, or billing imports.
 * Not wired to API/UI until G5d.5d+.
 */

import "server-only";

import { createHash } from "node:crypto";

import type {
  WeekShadowComparisonInput,
  WeekShadowEvaluationDto,
  WeekShadowValidationResult,
  WeekShadowWouldAffectDay,
} from "@/lib/menu-profile/runtimeMappingWeekShadowTypes";
import {
  WEEK_SHADOW_FORBIDDEN_OUTPUT_FIELDS,
  WEEK_SHADOW_HELPER_BASE_BLOCKED_REASONS,
  ZERO_WEEK_SHADOW_CHANGE_COUNTERS,
} from "@/lib/menu-profile/runtimeMappingWeekShadowTypes";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const WEEKDAY_TO_KEY: Record<number, WeekShadowWouldAffectDay["weekdayKey"]> = {
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resolveEvaluatedAt(input: WeekShadowComparisonInput): string {
  if (typeof input.evaluatedAt === "string" && input.evaluatedAt.trim()) {
    return input.evaluatedAt.trim();
  }
  return new Date().toISOString();
}

function weekdayKeyFromDateISO(dateISO: string): WeekShadowWouldAffectDay["weekdayKey"] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO.trim());
  if (!match) return null;
  const date = new Date(`${dateISO.trim()}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return WEEKDAY_TO_KEY[date.getUTCDay()] ?? null;
}

function resolveWeekdayKey(
  day: Record<string, unknown>,
  dateISO: string,
): WeekShadowWouldAffectDay["weekdayKey"] {
  const raw = day.weekdayKey ?? day.weekday ?? day.dayKey;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase().slice(0, 3);
    if (WEEKDAY_KEYS.includes(normalized as (typeof WEEKDAY_KEYS)[number])) {
      return normalized as WeekShadowWouldAffectDay["weekdayKey"];
    }
  }
  return weekdayKeyFromDateISO(dateISO) ?? "mon";
}

function extractDayDateISO(day: unknown): string | null {
  if (!isPlainObject(day)) return null;
  for (const key of ["dateISO", "date", "serviceDate", "isoDate"]) {
    const value = day[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function indexDaysByDate(payload: unknown): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (!isPlainObject(payload)) return out;

  const days = payload.days;
  if (!Array.isArray(days)) return out;

  for (const day of days) {
    const dateISO = extractDayDateISO(day);
    if (dateISO) {
      out.set(dateISO, day);
    }
  }

  return out;
}

function publishShadowHasNonZeroImpact(input: WeekShadowComparisonInput): boolean {
  const publishShadow = input.publishShadow;
  if (!publishShadow) return false;

  const buckets = [publishShadow.publishImpact, publishShadow.meta];
  for (const bucket of buckets) {
    if (!isPlainObject(bucket)) continue;
    for (const value of Object.values(bucket)) {
      if (typeof value === "number" && value !== 0) {
        return true;
      }
    }
  }

  return false;
}

export function validateWeekShadowComparisonInput(
  input: WeekShadowComparisonInput,
): WeekShadowValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(input.menuProfileId)) {
    errors.push("menuProfileId must be a non-empty string");
  }
  if (!isNonEmptyString(input.sourceDraftId)) {
    errors.push("sourceDraftId must be a non-empty string");
  }
  if (!isNonEmptyString(input.sourceMappingVersion)) {
    errors.push("sourceMappingVersion must be a non-empty string");
  }
  if (input.currentWeekPayload === undefined || input.currentWeekPayload === null) {
    errors.push("currentWeekPayload is required");
  }
  if (input.shadowWeekPayload === undefined || input.shadowWeekPayload === null) {
    errors.push("shadowWeekPayload is required");
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidWeekShadowComparisonInput(
  input: WeekShadowComparisonInput,
): asserts input is WeekShadowComparisonInput {
  const result = validateWeekShadowComparisonInput(input);
  if (!result.ok) {
    throw new Error(`Invalid week shadow comparison input: ${result.errors.join("; ")}`);
  }
}

export function stableSerializeWeekPayload(payload: unknown, seen = new WeakSet<object>()): string {
  if (payload === null) return "null";
  if (payload === undefined) return "undefined";

  const valueType = typeof payload;
  if (valueType === "string") return JSON.stringify(payload);
  if (valueType === "number" || valueType === "boolean") return JSON.stringify(payload);
  if (valueType === "bigint") return JSON.stringify(payload.toString());
  if (valueType === "function" || valueType === "symbol") {
    throw new Error("Week shadow payload must not contain functions or symbols");
  }

  if (payload instanceof Date) {
    return JSON.stringify(payload.toISOString());
  }

  if (Array.isArray(payload)) {
    const items = payload.map((item) => stableSerializeWeekPayload(item, seen));
    return `[${items.join(",")}]`;
  }

  if (isPlainObject(payload)) {
    if (seen.has(payload)) {
      throw new Error("Week shadow payload must not contain circular references");
    }
    seen.add(payload);

    const keys = Object.keys(payload).sort();
    const entries = keys.map((key) => {
      const serializedValue = stableSerializeWeekPayload(payload[key], seen);
      return `${JSON.stringify(key)}:${serializedValue}`;
    });

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(String(payload));
}

export function stableHashWeekPayload(payload: unknown): string {
  const serialized = stableSerializeWeekPayload(payload);
  const digest = createHash("sha256").update(serialized, "utf8").digest("hex");
  return `sha256:${digest}`;
}

export function buildWeekShadowBlockedReasons(input: WeekShadowComparisonInput): string[] {
  const reasons: string[] = [...WEEK_SHADOW_HELPER_BASE_BLOCKED_REASONS];

  if (publishShadowHasNonZeroImpact(input)) {
    reasons.push("publish_shadow_impact_not_zero");
  }

  return reasons;
}

function buildWouldAffectDays(
  input: WeekShadowComparisonInput,
  hashesEqual: boolean,
): WeekShadowWouldAffectDay[] {
  if (hashesEqual) return [];

  const currentDays = indexDaysByDate(input.currentWeekPayload);
  const shadowDays = indexDaysByDate(input.shadowWeekPayload);
  const allDates = new Set([...currentDays.keys(), ...shadowDays.keys()]);
  const affected: WeekShadowWouldAffectDay[] = [];

  for (const dateISO of [...allDates].sort()) {
    const currentDay = currentDays.get(dateISO) ?? null;
    const shadowDay = shadowDays.get(dateISO) ?? null;
    const currentHash = stableHashWeekPayload(currentDay);
    const shadowHash = stableHashWeekPayload(shadowDay);

    if (currentHash === shadowHash) continue;

    const dayRecord = isPlainObject(shadowDay)
      ? shadowDay
      : isPlainObject(currentDay)
        ? currentDay
        : {};

    affected.push({
      dateISO,
      weekdayKey: resolveWeekdayKey(dayRecord, dateISO),
      status: "hypothetical_diff_only",
      notes: ["Evidence-only diff — not employee-visible"],
    });
  }

  return affected;
}

function buildComparisonNotes(hashesEqual: boolean): string[] {
  const notes = ["Week shadow comparison only — no /api/week mutation"];

  if (!hashesEqual) {
    notes.push("Hash diff detected — evidence-only projection, not employee-visible");
  }

  return notes;
}

function assertValidWeekShadowEvaluation(dto: WeekShadowEvaluationDto): void {
  if (dto.shadowOnly !== true) {
    throw new Error("Week shadow evaluation must have shadowOnly: true");
  }
  if (dto.providerOnly !== true) {
    throw new Error("Week shadow evaluation must have providerOnly: true");
  }

  for (const [key, value] of Object.entries(ZERO_WEEK_SHADOW_CHANGE_COUNTERS)) {
    if (dto[key as keyof typeof ZERO_WEEK_SHADOW_CHANGE_COUNTERS] !== value) {
      throw new Error(`${key} must remain 0 for week shadow evaluation`);
    }
  }

  for (const forbidden of WEEK_SHADOW_FORBIDDEN_OUTPUT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(dto, forbidden)) {
      throw new Error(`Week shadow DTO must not include forbidden field: ${forbidden}`);
    }
  }
}

export function buildRuntimeMappingWeekShadowEvaluation(
  input: WeekShadowComparisonInput,
): WeekShadowEvaluationDto {
  assertValidWeekShadowComparisonInput(input);

  const currentWeekPayloadHash = stableHashWeekPayload(input.currentWeekPayload);
  const shadowWeekPayloadHash = stableHashWeekPayload(input.shadowWeekPayload);
  const hashesEqual = currentWeekPayloadHash === shadowWeekPayloadHash;

  const blockedReasons = buildWeekShadowBlockedReasons(input);
  if (!hashesEqual) {
    blockedReasons.push("week_payload_hash_diff_detected");
  }

  const dto: WeekShadowEvaluationDto = {
    shadowOnly: true,
    providerOnly: true,
    evaluatedAt: resolveEvaluatedAt(input),
    menuProfileId: input.menuProfileId.trim(),
    sourceDraftId: input.sourceDraftId.trim(),
    sourceMappingVersion: input.sourceMappingVersion.trim(),
    currentWeekUnchanged: hashesEqual,
    ...ZERO_WEEK_SHADOW_CHANGE_COUNTERS,
    wouldAffectDays: buildWouldAffectDays(input, hashesEqual),
    blockedReasons,
    comparison: {
      currentWeekPayloadHash,
      shadowWeekPayloadHash,
      hashesEqual,
      notes: buildComparisonNotes(hashesEqual),
    },
  };

  assertValidWeekShadowEvaluation(dto);
  return dto;
}

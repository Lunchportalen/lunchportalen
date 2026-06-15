// lib/agreements/changeRequestValidation.ts
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import type { PackageByDayRequestedChange } from "@/lib/agreements/changeRequestTypes";
import { DAY_KEYS, type DayKey, type Tier } from "@/lib/agreements/normalize";

export type ValidationOk = { ok: true };
export type ValidationErr = { ok: false; code: string; message: string };
export type ValidationResult = ValidationOk | ValidationErr;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
}

function normTier(v: unknown): Tier | null {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS" || s === "LUXUS" || s === "ENTERPRISE") return s as Tier;
  return null;
}

function normDayKey(v: unknown): DayKey | null {
  const s = safeStr(v).toLowerCase();
  if ((DAY_KEYS as readonly string[]).includes(s)) return s as DayKey;
  const aliases: Record<string, DayKey> = {
    monday: "mon",
    tuesday: "tue",
    wednesday: "wed",
    thursday: "thu",
    friday: "fri",
  };
  return aliases[s] ?? null;
}

export function parsePackageByDayRequestedChange(raw: unknown): ValidationResult & { value?: PackageByDayRequestedChange } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, code: "INVALID_REQUESTED_CHANGE", message: "requested_change må være et objekt." };
  }

  const dayOverridesRaw = (raw as Record<string, unknown>).day_overrides;
  if (!dayOverridesRaw || typeof dayOverridesRaw !== "object" || Array.isArray(dayOverridesRaw)) {
    return { ok: false, code: "INVALID_DAY_OVERRIDES", message: "day_overrides må være et objekt." };
  }

  const normalized: PackageByDayRequestedChange["day_overrides"] = {};
  for (const [key, val] of Object.entries(dayOverridesRaw as Record<string, unknown>)) {
    const dayKey = normDayKey(key);
    if (!dayKey) {
      return { ok: false, code: "INVALID_WEEKDAY", message: `Ugyldig ukedag: ${key}.` };
    }
    if (!val || typeof val !== "object" || Array.isArray(val)) {
      return { ok: false, code: "INVALID_DAY_OVERRIDE", message: `Ugyldig override for ${dayKey}.` };
    }
    const pkg = normTier((val as Record<string, unknown>).package ?? (val as Record<string, unknown>).tier);
    if (!pkg) {
      return { ok: false, code: "INVALID_PACKAGE", message: `Ugyldig pakke for ${dayKey}.` };
    }
    normalized[dayKey] = { package: pkg };
  }

  if (Object.keys(normalized).length === 0) {
    return { ok: false, code: "EMPTY_DAY_OVERRIDES", message: "Minst én dag må angis i day_overrides." };
  }

  return { ok: true, value: { day_overrides: normalized } };
}

export function validateEffectiveFrom(effectiveFrom: unknown): ValidationResult {
  if (!isIsoDate(effectiveFrom)) {
    return { ok: false, code: "INVALID_EFFECTIVE_FROM", message: "effective_from må være YYYY-MM-DD." };
  }
  return { ok: true };
}

export function validateEffectiveTo(effectiveFrom: string, effectiveTo: unknown): ValidationResult {
  if (effectiveTo == null || safeStr(effectiveTo) === "") return { ok: true };
  if (!isIsoDate(effectiveTo)) {
    return { ok: false, code: "INVALID_EFFECTIVE_TO", message: "effective_to må være YYYY-MM-DD." };
  }
  if (effectiveTo < effectiveFrom) {
    return { ok: false, code: "INVALID_EFFECTIVE_RANGE", message: "effective_to kan ikke være før effective_from." };
  }
  return { ok: true };
}

export function validateOverridesAgainstDeliveryDays(
  deliveryDays: DayKey[],
  requested: PackageByDayRequestedChange,
): ValidationResult {
  for (const dayKey of Object.keys(requested.day_overrides) as DayKey[]) {
    if (!deliveryDays.includes(dayKey)) {
      return {
        ok: false,
        code: "DAY_NOT_IN_AGREEMENT",
        message: `${dayKey} er ikke en leveringsdag i aktiv avtale.`,
      };
    }
  }
  return { ok: true };
}

export function buildCurrentSnapshot(input: {
  agreementId: string;
  providerId: string;
  tier: string | null;
  deliveryDays: unknown;
  dayTiers: Partial<Record<DayKey, Tier>>;
}): Record<string, unknown> {
  const deliveryNorm = normalizeDeliveryDaysStrict(input.deliveryDays);
  return {
    agreement_id: input.agreementId,
    provider_id: input.providerId,
    tier: input.tier,
    delivery_days: deliveryNorm.days,
    day_tiers: input.dayTiers,
    captured_at: new Date().toISOString(),
  };
}

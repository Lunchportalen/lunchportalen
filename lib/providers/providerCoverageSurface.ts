// lib/providers/providerCoverageSurface.ts
// Provider-facing helpers for /leverandor/omrader (i18n keys + locale formatting).
//
// Prinsipp:
// - UI-copy lives in messages/provider.coverage.* — this module exposes ids and keys only.
// - Aldri rå enums/tekniske verdier i brukerrettet UI.
// - Dag-labels hentes via translator (UI-mapping, lagrede verdier røres ikke).
// - Ingen server-avhengigheter: brukes av både server page og client components.

import { WEEKDAY_KEYS, type WeekdayKey } from "@/lib/providers/serviceAreaShared";

export type CoverageTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export const PROVIDER_COVERAGE_EMPTY_STEP_KEYS = ["step1", "step2", "step3"] as const;

export type CoverageStatusKey = "active" | "inactive" | "paused" | "unknown";

export function coverageStatusKey(status: unknown): CoverageStatusKey {
  if (status === true) return "active";
  if (status === false) return "inactive";
  const s = String(status ?? "").trim().toUpperCase();
  if (s === "ACTIVE" || s === "TRUE") return "active";
  if (s === "INACTIVE" || s === "FALSE") return "inactive";
  if (s === "PAUSED") return "paused";
  return "unknown";
}

export function providerCoverageSubheading(providerName: string, t: CoverageTranslator): string {
  const name = String(providerName ?? "").trim();
  return name ? t("page.leadWithProvider", { providerName: name }) : t("page.leadNoProvider");
}

/** Rolig summary over tabellen — beregnes fra hele resultatsettet (ingen pagination på flaten). */
export function providerCoverageSummary(rows: ReadonlyArray<{ active: boolean }>, t: CoverageTranslator): string {
  const list = Array.isArray(rows) ? rows : [];
  const active = list.filter((r) => r.active === true).length;
  const inactive = list.length - active;
  const inactiveSuffix = inactive > 0 ? t("summary.inactiveSuffix", { count: inactive }) : "";

  if (active === 0) return `${t("summary.noneActive")}${inactiveSuffix}`;
  if (active === 1) return `${t("summary.oneActive")}${inactiveSuffix}`;
  return `${t("summary.manyActive", { count: active })}${inactiveSuffix}`;
}

/** Provider-safe statuslabel — aldri rå enum/teknisk verdi i UI. */
export function coverageStatusLabel(status: unknown, t: CoverageTranslator): string {
  return t(`status.${coverageStatusKey(status)}`);
}

const ALL_WEEKDAYS: ReadonlyArray<string> = WEEKDAY_KEYS;

/**
 * UI-labels for leveringsdager. Alle hverdager vises som weekdaysRange,
 * ellers korte labels. Lagrede verdier røres ikke.
 */
export function formatCoverageDays(days: ReadonlyArray<string>, t: CoverageTranslator): string {
  const normalized = (Array.isArray(days) ? days : []).map((d) => String(d ?? "").trim().toLowerCase());
  const known = WEEKDAY_KEYS.filter((k) => normalized.includes(k));
  if (known.length === 0) return t("format.emDash");
  if (ALL_WEEKDAYS.every((k) => normalized.includes(k))) return t("weekdays.weekdaysRange");
  return known.map((k) => t(`weekdays.${k as WeekdayKey}`)).join(", ");
}

/** Ansattekrav for området: «20+», «20–50», «≤50» eller em-dash. */
export function formatCoverageEmployees(
  min: number | null,
  max: number | null,
  t: CoverageTranslator,
): string {
  if (min != null && max != null) return t("format.employeesRange", { min, max });
  if (min != null) return t("format.employeesMin", { min });
  if (max != null) return t("format.employeesMax", { max });
  return t("format.emDash");
}

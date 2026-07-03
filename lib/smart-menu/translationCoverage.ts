/**
 * SMART-4 — locale coverage reporting for provider translation QA (pure helpers).
 */
import type { AppLocale } from "@/lib/i18n/localeRegistry";
import type { MenuTranslationSourceCandidate } from "@/lib/smart-menu/menuTranslationSources";
import { MENU_TRANSLATION_TARGET_LOCALES } from "@/lib/smart-menu/menuTranslationSources";
import type { ProviderMenuTranslationDto } from "@/lib/smart-menu/providerTranslationApproval";
import {
  isEmployeeVisibleTranslation,
  originalTextHashMatches,
  type MenuContentSourceKind,
  type MenuContentTranslationStatus,
} from "@/lib/smart-menu/translationStatus";

export type CandidateLocaleStatus =
  | "missing"
  | "draft"
  | "suggested"
  | "approved"
  | "rejected"
  | "stale"
  | "blank_translated"
  | "employee_visible";

export type CandidateLocaleCoverage = {
  locale: AppLocale;
  status: CandidateLocaleStatus;
  employeeVisible: boolean;
  hashMatches: boolean;
  translationRowId: string | null;
};

export type CandidateCoverageDetail = MenuTranslationSourceCandidate & {
  perLocale: CandidateLocaleCoverage[];
};

export type LocaleCoverageSummary = {
  locale: AppLocale;
  totalCandidates: number;
  employeeVisible: number;
  missing: number;
  draft: number;
  suggested: number;
  rejected: number;
  stale: number;
  blankTranslated: number;
  coveragePercent: number;
};

export type SourceKindCoverageSummary = {
  sourceKind: MenuContentSourceKind;
  totalCandidates: number;
  employeeVisible: number;
  missing: number;
  draft: number;
  suggested: number;
  rejected: number;
  stale: number;
  blankTranslated: number;
};

export type TranslationCoverageReport = {
  totalCandidates: number;
  locales: LocaleCoverageSummary[];
  bySourceKind: SourceKindCoverageSummary[];
  candidates: CandidateCoverageDetail[];
  staleCount: number;
  missingCount: number;
};

type TranslationRowLike = Pick<
  ProviderMenuTranslationDto,
  | "id"
  | "sourceKind"
  | "sourceRef"
  | "field"
  | "locale"
  | "status"
  | "originalText"
  | "originalTextHash"
  | "translatedText"
  | "hashMatches"
>;

function rowLookupKey(parts: {
  sourceKind: MenuContentSourceKind;
  sourceRef: string;
  field: MenuTranslationSourceCandidate["field"];
  locale: AppLocale;
}): string {
  return `${parts.sourceKind}\u001f${parts.sourceRef}\u001f${parts.field}\u001f${parts.locale}`;
}

function coveragePercent(visible: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((visible / total) * 1000) / 10;
}

function classifyRowForCandidate(
  candidate: MenuTranslationSourceCandidate,
  locale: AppLocale,
  row: TranslationRowLike | undefined,
): CandidateLocaleCoverage {
  if (!row) {
    return {
      locale,
      status: "missing",
      employeeVisible: false,
      hashMatches: false,
      translationRowId: null,
    };
  }

  const hashMatches =
    row.originalTextHash === candidate.original_text_hash &&
    originalTextHashMatches(row.originalTextHash, candidate.original_text);
  const translatedText = row.translatedText != null ? String(row.translatedText).trim() : "";
  const status = row.status as MenuContentTranslationStatus;

  if (
    isEmployeeVisibleTranslation(status, hashMatches) &&
    translatedText.length > 0
  ) {
    return {
      locale,
      status: "employee_visible",
      employeeVisible: true,
      hashMatches: true,
      translationRowId: row.id,
    };
  }

  if (status === "approved" && !hashMatches) {
    return {
      locale,
      status: "stale",
      employeeVisible: false,
      hashMatches: false,
      translationRowId: row.id,
    };
  }

  if (status === "approved" && translatedText.length === 0) {
    return {
      locale,
      status: "blank_translated",
      employeeVisible: false,
      hashMatches,
      translationRowId: row.id,
    };
  }

  if (status === "stale") {
    return {
      locale,
      status: "stale",
      employeeVisible: false,
      hashMatches,
      translationRowId: row.id,
    };
  }

  if (status === "missing") {
    return {
      locale,
      status: "missing",
      employeeVisible: false,
      hashMatches,
      translationRowId: row.id,
    };
  }

  if (status === "draft" || status === "suggested" || status === "rejected") {
    return {
      locale,
      status,
      employeeVisible: false,
      hashMatches,
      translationRowId: row.id,
    };
  }

  return {
    locale,
    status: "missing",
    employeeVisible: false,
    hashMatches,
    translationRowId: row.id,
  };
}

function emptyLocaleSummary(locale: AppLocale): LocaleCoverageSummary {
  return {
    locale,
    totalCandidates: 0,
    employeeVisible: 0,
    missing: 0,
    draft: 0,
    suggested: 0,
    rejected: 0,
    stale: 0,
    blankTranslated: 0,
    coveragePercent: 0,
  };
}

function emptySourceKindSummary(sourceKind: MenuContentSourceKind): SourceKindCoverageSummary {
  return {
    sourceKind,
    totalCandidates: 0,
    employeeVisible: 0,
    missing: 0,
    draft: 0,
    suggested: 0,
    rejected: 0,
    stale: 0,
    blankTranslated: 0,
  };
}

function bumpSummary(
  summary: LocaleCoverageSummary | SourceKindCoverageSummary,
  status: CandidateLocaleStatus,
): void {
  summary.totalCandidates += 1;
  if (status === "employee_visible") summary.employeeVisible += 1;
  if (status === "missing") summary.missing += 1;
  if (status === "draft") summary.draft += 1;
  if (status === "suggested") summary.suggested += 1;
  if (status === "rejected") summary.rejected += 1;
  if (status === "stale") summary.stale += 1;
  if (status === "blank_translated") summary.blankTranslated += 1;
}

export function computeTranslationCoverage(params: {
  candidates: MenuTranslationSourceCandidate[];
  rows: TranslationRowLike[];
  locales?: AppLocale[];
}): TranslationCoverageReport {
  const locales = params.locales ?? [...MENU_TRANSLATION_TARGET_LOCALES];
  const rowByKey = new Map<string, TranslationRowLike>();
  for (const row of params.rows) {
    rowByKey.set(
      rowLookupKey({
        sourceKind: row.sourceKind,
        sourceRef: row.sourceRef,
        field: row.field,
        locale: row.locale,
      }),
      row,
    );
  }

  const localeSummaries = new Map<AppLocale, LocaleCoverageSummary>(
    locales.map((locale) => [locale, emptyLocaleSummary(locale)]),
  );
  const sourceKindSummaries = new Map<MenuContentSourceKind, SourceKindCoverageSummary>();

  const candidates: CandidateCoverageDetail[] = params.candidates.map((candidate) => {
    const perLocale = locales.map((locale) => {
      const row = rowByKey.get(
        rowLookupKey({
          sourceKind: candidate.source_kind,
          sourceRef: candidate.source_ref,
          field: candidate.field,
          locale,
        }),
      );
      const coverage =
        row === undefined
          ? ({
              locale,
              status: "missing" as const,
              employeeVisible: false,
              hashMatches: false,
              translationRowId: null,
            } satisfies CandidateLocaleCoverage)
          : classifyRowForCandidate(candidate, locale, row);

      const localeSummary = localeSummaries.get(locale)!;
      bumpSummary(localeSummary, coverage.status);

      let kindSummary = sourceKindSummaries.get(candidate.source_kind);
      if (!kindSummary) {
        kindSummary = emptySourceKindSummary(candidate.source_kind);
        sourceKindSummaries.set(candidate.source_kind, kindSummary);
      }
      bumpSummary(kindSummary, coverage.status);

      return coverage;
    });

    return { ...candidate, perLocale };
  });

  for (const summary of localeSummaries.values()) {
    summary.coveragePercent = coveragePercent(summary.employeeVisible, summary.totalCandidates);
  }

  let staleCount = 0;
  let missingCount = 0;
  for (const candidate of candidates) {
    for (const localeCoverage of candidate.perLocale) {
      if (localeCoverage.status === "stale") staleCount += 1;
      if (localeCoverage.status === "missing") missingCount += 1;
    }
  }

  return {
    totalCandidates: params.candidates.length,
    locales: [...localeSummaries.values()],
    bySourceKind: [...sourceKindSummaries.values()],
    candidates,
    staleCount,
    missingCount,
  };
}

/** Candidates with at least one missing locale — for provider QA list. */
export function listCandidatesMissingTranslation(
  report: TranslationCoverageReport,
): CandidateCoverageDetail[] {
  return report.candidates.filter((candidate) =>
    candidate.perLocale.some((locale) => locale.status === "missing"),
  );
}

/** Candidates with stale/hash mismatch on any locale. */
export function listCandidatesWithStaleLocale(
  report: TranslationCoverageReport,
): CandidateCoverageDetail[] {
  return report.candidates.filter((candidate) =>
    candidate.perLocale.some((locale) => locale.status === "stale"),
  );
}

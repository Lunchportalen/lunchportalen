/**
 * SMART-4 — server loader for provider translation source candidates + coverage.
 */
import "server-only";

import { fetchLunchCategoryRowsForProvider } from "@/lib/cms/lunchCategory";
import { buildMenuCatalogSnapshot } from "@/lib/provider-menu/providerMenuCatalogReadModel";
import {
  extractTranslationSourcesFromCatalog,
  extractTranslationSourcesFromOrderWindowDays,
  mergeTranslationSourceCandidates,
  type MenuTranslationSourceCandidate,
} from "@/lib/smart-menu/menuTranslationSources";
import { loadProviderOrderWindowDaysForTranslationSources } from "@/lib/smart-menu/providerOrderWindowSourceDays";
import {
  listProviderMenuTranslations,
  type ProviderMenuTranslationDto,
} from "@/lib/smart-menu/providerTranslationApproval";
import {
  computeTranslationCoverage,
  listCandidatesMissingTranslation,
  listCandidatesWithStaleLocale,
  type TranslationCoverageReport,
} from "@/lib/smart-menu/translationCoverage";

export type ProviderTranslationSourcesReport = {
  providerId: string;
  candidates: MenuTranslationSourceCandidate[];
  coverage: TranslationCoverageReport;
  missingCandidates: MenuTranslationSourceCandidate[];
  staleCandidates: MenuTranslationSourceCandidate[];
  sourceTotals: {
    catalog: number;
    orderWindow: number;
    combined: number;
  };
  candidateKinds: MenuTranslationSourceCandidate["source_kind"][];
  /** Provider QA only — never expose to employee APIs. */
  employeeTranslationsLive: false;
};

export async function loadProviderTranslationSourcesReport(
  providerId: string,
): Promise<ProviderTranslationSourcesReport> {
  const pid = String(providerId ?? "").trim();
  const lunchRows = await fetchLunchCategoryRowsForProvider(pid);
  const catalog = buildMenuCatalogSnapshot(lunchRows);
  const catalogCandidates = extractTranslationSourcesFromCatalog(pid, catalog);
  const orderWindowDays = await loadProviderOrderWindowDaysForTranslationSources(pid);
  const orderWindowCandidates = extractTranslationSourcesFromOrderWindowDays(pid, orderWindowDays);
  const candidates = mergeTranslationSourceCandidates(catalogCandidates, orderWindowCandidates);

  const translations: ProviderMenuTranslationDto[] = await listProviderMenuTranslations(pid, {});
  const coverage = computeTranslationCoverage({ candidates, rows: translations });

  const missingDetails = listCandidatesMissingTranslation(coverage);
  const staleDetails = listCandidatesWithStaleLocale(coverage);
  const candidateKinds = [...new Set(candidates.map((c) => c.source_kind))].sort();

  return {
    providerId: pid,
    candidates,
    coverage,
    missingCandidates: missingDetails.map(({ perLocale: _perLocale, ...candidate }) => candidate),
    staleCandidates: staleDetails.map(({ perLocale: _perLocale, ...candidate }) => candidate),
    sourceTotals: {
      catalog: catalogCandidates.length,
      orderWindow: orderWindowCandidates.length,
      combined: candidates.length,
    },
    candidateKinds,
    employeeTranslationsLive: false,
  };
}

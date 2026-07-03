/**
 * SMART-4 — server loader for provider translation source candidates + coverage.
 */
import "server-only";

import { fetchLunchCategoryRowsForProvider } from "@/lib/cms/lunchCategory";
import { buildMenuCatalogSnapshot } from "@/lib/provider-menu/providerMenuCatalogReadModel";
import {
  extractTranslationSourcesFromCatalog,
  mergeTranslationSourceCandidates,
  type MenuTranslationSourceCandidate,
} from "@/lib/smart-menu/menuTranslationSources";
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
  const candidates = mergeTranslationSourceCandidates(catalogCandidates);

  const translations: ProviderMenuTranslationDto[] = await listProviderMenuTranslations(pid, {});
  const coverage = computeTranslationCoverage({ candidates, rows: translations });

  const missingDetails = listCandidatesMissingTranslation(coverage);
  const staleDetails = listCandidatesWithStaleLocale(coverage);

  return {
    providerId: pid,
    candidates,
    coverage,
    missingCandidates: missingDetails.map(({ perLocale: _perLocale, ...candidate }) => candidate),
    staleCandidates: staleDetails.map(({ perLocale: _perLocale, ...candidate }) => candidate),
    employeeTranslationsLive: false,
  };
}

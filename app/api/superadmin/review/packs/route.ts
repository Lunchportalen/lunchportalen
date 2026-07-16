export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { gateReviewApi } from "@/lib/review/reviewApiGuard";
import { auditAllCountryReviewPacks, buildCountryReviewPack } from "@/lib/review/countryReviewPack";
import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import { buildReviewerStaffingPlan } from "@/lib/review/staffingPlan";
import {
  buildRegistrationRequirementSeeds,
  summarizeRegistrationSeeds,
} from "@/lib/review/registrationOperations";
import { classifyAllCriticalQuestions } from "@/lib/review/criticalQuestions";

export async function GET(req: Request) {
  const g = await gateReviewApi(req);
  if (!g.ok) return g.response;

  const url = new URL(req.url);
  const country = url.searchParams.get("country")?.toUpperCase();
  if (country) {
    if (!/^[A-Z]{2}$/.test(country) || !SUPPORTED_COUNTRY_CODES.includes(country as CountryCode)) {
      return jsonErr(g.rid, "Ugyldig landkode", 422, "validation");
    }
    return jsonOk(g.rid, { pack: buildCountryReviewPack(country as CountryCode) });
  }

  const audit = auditAllCountryReviewPacks();
  const questions = classifyAllCriticalQuestions();
  const staffing = buildReviewerStaffingPlan();
  const regs = buildRegistrationRequirementSeeds();

  return jsonOk(g.rid, {
    summary: audit.summary,
    release: { sha: audit.releaseSha, migrationHead: audit.migrationHead },
    criticalQuestions: {
      total: questions.total,
      closedFactual: questions.closedFactual,
      externalDecisionRequired: questions.externalDecisionRequired,
      unclassified: questions.unclassified,
      withoutTask: questions.withoutTask,
    },
    staffing: {
      minimumCoverage: staffing.minimumCoverage,
      filled: staffing.filled,
      unfilledCount: staffing.unfilledScopes.length,
      criticalPathCountries: staffing.criticalPathCountries,
    },
    registrations: summarizeRegistrationSeeds(regs),
    packs: audit.packs.map((p) => ({
      countryCode: p.identity.countryCode,
      reviewReady: p.reviewReady,
      missingMandatoryCount: p.missingMandatoryCount,
      externalDecisionCount: p.externalDecisionCount,
      unclassifiedCriticalCount: p.unclassifiedCriticalCount,
      packChecksum: p.packChecksum,
      approvals: p.approvals,
    })),
  });
}

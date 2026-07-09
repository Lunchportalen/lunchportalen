export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { loadProviderTranslationSourcesReport } from "@/lib/smart-menu/providerTranslationSources";

const VIEW_ROLE = "provider_viewer" as const;

async function resolveProviderViewer(rid: string) {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return { error: jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED") };
  }

  const userId = String(auth.user.id).trim();
  const ctx = await getProviderAdminContext(userId);
  const provider = ctx.primaryProvider;
  if (!provider) {
    return { error: jsonErr(rid, "Ingen leverandørtilgang.", 403, "FORBIDDEN") };
  }

  const canView = await hasProviderRole(userId, provider.id, VIEW_ROLE);
  if (!canView) {
    return { error: jsonErr(rid, "Du har ikke tilgang til oversettelseskilder.", 403, "FORBIDDEN") };
  }

  return { provider };
}

export async function GET(_req: NextRequest) {
  const rid = makeRid("prov_menu_tr_src");

  const resolved = await resolveProviderViewer(rid);
  if ("error" in resolved && resolved.error) return resolved.error;
  const { provider } = resolved as {
    provider: { id: string; slug: string; name: string };
  };

  try {
    const report = await loadProviderTranslationSourcesReport(provider.id);
    return jsonOk(rid, {
      providerId: report.providerId,
      candidateCount: report.candidates.length,
      candidates: report.candidates,
      coverage: report.coverage,
      missingCandidates: report.missingCandidates,
      staleCandidates: report.staleCandidates,
      sourceTotals: report.sourceTotals,
      candidateKinds: report.candidateKinds,
      sourceRefGuidance: {
        mealItem: "item.key",
        category: "category slug/key at runtime (e.g. paasmurt, salat)",
        allergen: "normalized allergen token",
        menuDay: "ISO date:category suffix when present in order window",
      },
      employeeFallbackRule: "original_provider_text",
      partialCoverageExpected: true,
      employeeTranslationsLive: false,
    });
  } catch {
    return jsonErr(rid, "Kunne ikke hente oversettelseskilder.", 500, "INTERNAL_ERROR");
  }
}

export async function POST() {
  const rid = makeRid("prov_menu_tr_src");
  return jsonErr(
    rid,
    "Materialisering av rader er ikke aktivert i SMART-4 — opprett utkast manuelt.",
    405,
    "METHOD_NOT_ALLOWED",
  );
}

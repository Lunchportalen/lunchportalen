import "server-only";

import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";

/**
 * Tenant UUID for backoffice CMS AI (governance, logging, runAi) when the session has no company_id
 * (superadmin platform CMS). Optional override: CMS_AI_DEFAULT_COMPANY_ID / LP_CMS_AI_DEFAULT_COMPANY_ID.
 *
 * When env is unset, all CMS runtime modes use this deterministic id (local_provider, reserve, remote_backend).
 * Company row may be absent — governance then resolves to empty company policy (see loadCompanyRunnerGovernance).
 */
export const LOCAL_PROVIDER_CMS_AI_ATTRIBUTION_COMPANY_ID =
  "00000000-0000-4000-8000-00000000a1c1";

/**
 * Resolve canonical tenant company id for CMS editor AI routes.
 */
export function resolveCmsAiTenantCompanyId(scopeCompanyId: string | null | undefined): string | null {
  const fromScope = String(scopeCompanyId ?? "").trim();
  if (fromScope) return fromScope;

  const fromEnv =
    String(process.env.CMS_AI_DEFAULT_COMPANY_ID ?? "").trim() ||
    String(process.env.LP_CMS_AI_DEFAULT_COMPANY_ID ?? "").trim();
  if (fromEnv) return fromEnv;

  const { mode } = getCmsRuntimeStatus();
  if (mode === "local_provider" || mode === "reserve" || mode === "remote_backend") {
    return LOCAL_PROVIDER_CMS_AI_ATTRIBUTION_COMPANY_ID;
  }

  return null;
}

/** Map legacy / metrics feature strings mistaken for tool ids → canonical registry tool id. */
export function normalizeSuggestToolId(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return t;
  const key = t.toLowerCase();
  const aliases: Record<string, string> = {
    improve_page: "content.maintain.page",
    improvepage: "content.maintain.page",
    seo_optimize: "seo.optimize.page",
    "seo.optimize": "seo.optimize.page",
    generate_sections: "landing.generate.sections",
    structured_intent: "experiment.generate.variants",
  };
  return aliases[key] ?? t;
}

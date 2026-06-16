import "server-only";

/** Read-only operational focus for pilot control — resolved from env or auto-discovery, never hardcoded tenant names. */

export type PilotControlScopeSource = "env" | "query" | "auto" | "none";

export type PilotControlScope = {
  companyId: string | null;
  providerId: string | null;
  source: PilotControlScopeSource;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function pilotScopeFromEnv(): Pick<PilotControlScope, "companyId" | "providerId"> {
  const companyId = safeStr(process.env.PILOT_CONTROL_COMPANY_ID);
  const providerId = safeStr(process.env.PILOT_CONTROL_PROVIDER_ID);
  return {
    companyId: companyId && isUuid(companyId) ? companyId : null,
    providerId: providerId && isUuid(providerId) ? providerId : null,
  };
}

export function pilotScopeFromQuery(searchParams?: {
  companyId?: string;
  providerId?: string;
}): Pick<PilotControlScope, "companyId" | "providerId"> {
  const companyId = safeStr(searchParams?.companyId);
  const providerId = safeStr(searchParams?.providerId);
  return {
    companyId: companyId && isUuid(companyId) ? companyId : null,
    providerId: providerId && isUuid(providerId) ? providerId : null,
  };
}

export function mergePilotScope(
  query: Pick<PilotControlScope, "companyId" | "providerId">,
  env: Pick<PilotControlScope, "companyId" | "providerId">,
  auto: Pick<PilotControlScope, "companyId" | "providerId">,
): PilotControlScope {
  if (query.companyId || query.providerId) {
    return {
      companyId: query.companyId ?? auto.companyId,
      providerId: query.providerId ?? auto.providerId,
      source: "query",
    };
  }
  if (env.companyId || env.providerId) {
    return {
      companyId: env.companyId ?? auto.companyId,
      providerId: env.providerId ?? auto.providerId,
      source: "env",
    };
  }
  if (auto.companyId && auto.providerId) {
    return { ...auto, source: "auto" };
  }
  return { companyId: null, providerId: null, source: "none" };
}

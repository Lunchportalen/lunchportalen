/**
 * Auto-repair suggestion AI capability: suggestAutoFix.
 * Suggests possible fixes from error/problem context (code, message, component, category).
 * Returns ordered fix suggestions with steps, optional command, and risk level. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "suggestAutoFix";

const suggestAutoFixCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Auto-repair suggestion AI: from problem context (errorCode, errorMessage, component, category), suggests possible fixes with steps, optional command, and risk level. Excludes already-tried fix IDs. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Suggest auto-fix input",
    properties: {
      problemContext: {
        type: "object",
        description: "Current problem/error context",
        properties: {
          errorCode: { type: "string", description: "e.g. ECONNREFUSED, ETIMEDOUT, 500" },
          errorMessage: { type: "string", description: "Raw or truncated message" },
          component: { type: "string", description: "e.g. api, database, auth, frontend" },
          category: {
            type: "string",
            description: "network | config | dependency | runtime | auth | data",
          },
          source: { type: "string", description: "Service or file" },
        },
      },
      fixesAlreadyTried: {
        type: "array",
        description: "Fix IDs already attempted (exclude from suggestions)",
        items: { type: "string" },
      },
      maxSuggestions: { type: "number", description: "Max fixes to return (default: 5)" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["problemContext"],
  },
  outputSchema: {
    type: "object",
    description: "Auto-fix suggestions result",
    required: ["suggestions", "summary", "generatedAt"],
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          required: ["fixId", "title", "steps", "riskLevel", "category"],
          properties: {
            fixId: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            steps: { type: "array", items: { type: "string" } },
            command: { type: "string" },
            riskLevel: { type: "string", enum: ["low", "medium", "high"] },
            category: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is fix suggestions only; no automatic execution or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(suggestAutoFixCapability);

export type ProblemContext = {
  errorCode?: string | null;
  errorMessage?: string | null;
  component?: string | null;
  category?: string | null;
  source?: string | null;
};

export type SuggestAutoFixInput = {
  problemContext: ProblemContext;
  fixesAlreadyTried?: string[] | null;
  maxSuggestions?: number | null;
  locale?: "nb" | "en" | null;
};

export type AutoFixSuggestion = {
  fixId: string;
  title: string;
  description?: string | null;
  steps: string[];
  command?: string | null;
  riskLevel: "low" | "medium" | "high";
  category: string;
};

export type SuggestAutoFixOutput = {
  suggestions: AutoFixSuggestion[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

type FixTemplate = {
  fixId: string;
  matchCodes: string[];
  matchKeywords: string[];
  matchCategories: string[];
  riskLevel: "low" | "medium" | "high";
  category: string;
  en: { title: string; description?: string; steps: string[]; command?: string };
  nb: { title: string; description?: string; steps: string[]; command?: string };
};

const FIX_TEMPLATES: FixTemplate[] = [
  {
    fixId: "restart-service",
    matchCodes: ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED"],
    matchKeywords: ["timeout", "connection refused", "reset"],
    matchCategories: ["network", "runtime"],
    riskLevel: "low",
    category: "runtime",
    en: {
      title: "Restart the affected service",
      description: "Transient connection issues often resolve after a restart.",
      steps: ["Identify the failing service or process.", "Gracefully stop the service.", "Start the service again.", "Verify health endpoint or logs."],
      command: "npm run build:enterprise && (restart your process)",
    },
    nb: {
      title: "Start tjenesten på nytt",
      description: "Midlertidige tilkoblingsfeil forsvinner ofte etter omstart.",
      steps: ["Identifiser den feilende tjenesten.", "Stopp tjenesten sikkert.", "Start tjenesten på nytt.", "Verifiser helsesjekk eller logger."],
    },
  },
  {
    fixId: "check-env",
    matchCodes: [],
    matchKeywords: ["environment", "env", "undefined", "missing", "required"],
    matchCategories: ["config"],
    riskLevel: "low",
    category: "config",
    en: {
      title: "Verify environment variables",
      description: "Ensure required env vars are set and loaded.",
      steps: ["List required variables (e.g. from docs or .env.example).", "Check they are set in the running environment.", "Restart the process after changing env.", "Confirm no secrets are logged."],
    },
    nb: {
      title: "Verifiser miljøvariabler",
      description: "Sjekk at nødvendige env-variabler er satt og lastet.",
      steps: ["List nødvendige variabler (f.eks. fra docs eller .env.example).", "Sjekk at de er satt i kjøremiljøet.", "Start prosessen på nytt etter endring.", "Bekreft at ingen hemmeligheter logges."],
    },
  },
  {
    fixId: "clear-cache",
    matchCodes: [],
    matchKeywords: ["stale", "cache", "invalid", "expired"],
    matchCategories: ["runtime", "config"],
    riskLevel: "low",
    category: "config",
    en: {
      title: "Clear relevant caches",
      description: "Stale or corrupted cache can cause unexpected errors.",
      steps: ["Identify cache layer (e.g. Next.js .next, browser, Redis).", "Clear or invalidate the cache safely.", "Rebuild or restart if needed.", "Verify behavior after cache clear."],
    },
    nb: {
      title: "Tøm relevante cacher",
      description: "Ute på dato eller korrupt cache kan gi uventede feil.",
      steps: ["Identifiser cachelag (f.eks. Next.js .next, nettleser, Redis).", "Tøm eller ugyldiggjør cachen sikkert.", "Bygg eller start på nytt ved behov.", "Verifiser atferd etter tømming."],
    },
  },
  {
    fixId: "reinstall-deps",
    matchCodes: ["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"],
    matchKeywords: ["cannot find module", "module not found", "dependency"],
    matchCategories: ["dependency"],
    riskLevel: "medium",
    category: "dependency",
    en: {
      title: "Reinstall dependencies",
      description: "Reinstall node_modules to fix missing or corrupted packages.",
      steps: ["Remove node_modules and lockfile (or keep lockfile for reproducibility).", "Run install (npm ci or npm install).", "Retry the failing command.", "If it persists, check package.json and peer deps."],
      command: "rm -rf node_modules && npm install",
    },
    nb: {
      title: "Reinstaller avhengigheter",
      description: "Reinstaller node_modules for å fikse manglende eller ødelagte pakker.",
      steps: ["Fjern node_modules (og evt. lockfile).", "Kjør npm ci eller npm install.", "Prøv den feilende kommandoen på nytt.", "Ved vedvarende feil: sjekk package.json og peer deps."],
      command: "rm -rf node_modules && npm install",
    },
  },
  {
    fixId: "check-db-connection",
    matchCodes: [],
    matchKeywords: ["database", "connection", "pool", "supabase", "postgres"],
    matchCategories: ["data", "network"],
    riskLevel: "medium",
    category: "data",
    en: {
      title: "Check database connectivity",
      description: "Verify DB URL, network, and pool limits.",
      steps: ["Confirm database URL and credentials in env.", "Check network/firewall allows outbound to DB host.", "Verify connection pool limits and current usage.", "Restart app and retry; check DB server logs if needed."],
    },
    nb: {
      title: "Sjekk database-tilkobling",
      description: "Verifiser DB-URL, nettverk og pool-grenser.",
      steps: ["Bekreft database-URL og påloggingsdetaljer i env.", "Sjekk at nettverk/firewall tillater utgang til DB-vert.", "Verifiser connection pool og bruk.", "Start app på nytt og prøv igjen; sjekk DB-logger ved behov."],
    },
  },
  {
    fixId: "auth-token-refresh",
    matchCodes: [],
    matchKeywords: ["unauthorized", "401", "token", "expired", "session"],
    matchCategories: ["auth"],
    riskLevel: "low",
    category: "auth",
    en: {
      title: "Refresh or re-authenticate",
      description: "Token or session may have expired.",
      steps: ["Confirm token/session expiry from error or logs.", "Use refresh flow if available, or re-login.", "Ensure client sends updated token in subsequent requests.", "Check server clock and token TTL if issues persist."],
    },
    nb: {
      title: "Oppdater token eller logg inn på nytt",
      description: "Token eller sesjon kan ha utløpt.",
      steps: ["Bekreft utløp fra feilmelding eller logger.", "Bruk refresh-flyt hvis tilgjengelig, eller logg inn på nytt.", "Sørg for at klient sender oppdatert token i neste forespørsel.", "Sjekk serverklokke og token TTL ved vedvarende feil."],
    },
  },
  {
    fixId: "increase-timeout",
    matchCodes: ["ETIMEDOUT", "ESOCKETTIMEDOUT"],
    matchKeywords: ["timeout", "timed out"],
    matchCategories: ["network"],
    riskLevel: "medium",
    category: "config",
    en: {
      title: "Increase timeout or optimize slow path",
      description: "Request or connection is exceeding current timeout.",
      steps: ["Identify the slow operation (e.g. API call, DB query).", "Temporarily increase timeout for that operation if safe.", "Profile and optimize the slow path (queries, external calls).", "Revert timeout to a reasonable value after optimization."],
    },
    nb: {
      title: "Øk timeout eller optimaliser treg sti",
      description: "Forespørsel eller tilkobling overskrider nåværende timeout.",
      steps: ["Identifiser den trege operasjonen (f.eks. API-kall, DB-spørring).", "Øk timeout midlertidig for den operasjonen hvis trygt.", "Profil og optimaliser den trege stien.", "Sett timeout tilbake til fornuftig verdi etterpå."],
    },
  },
  {
    fixId: "generic-runtime",
    matchCodes: [],
    matchKeywords: [],
    matchCategories: ["runtime"],
    riskLevel: "medium",
    category: "runtime",
    en: {
      title: "Review runtime logs and recent changes",
      description: "Generic runtime issue; narrow down with logs and diff.",
      steps: ["Capture full error stack and context from logs.", "Compare with last known good state (deploy, config).", "Revert or feature-flag recent changes if suspected.", "Reproduce in a minimal environment if possible."],
    },
    nb: {
      title: "Gå gjennom kjøretidslogger og nylige endringer",
      description: "Generell kjøretidsfeil; innsnevring med logger og diff.",
      steps: ["Hent full feilstack og kontekst fra logger.", "Sammenlign med sist kjente gode tilstand (deploy, config).", "Revert eller feature-flag nylige endringer ved mistanke.", "Reproduiser i minimalt miljø hvis mulig."],
    },
  },
];

function scoreMatch(
  ctx: ProblemContext,
  t: FixTemplate
): number {
  const code = safeStr(ctx.errorCode).toUpperCase();
  const msg = (ctx.errorMessage || "").toLowerCase();
  const cat = safeStr(ctx.category).toLowerCase();
  const comp = safeStr(ctx.component).toLowerCase();

  let score = 0;
  if (code && t.matchCodes.some((c) => code.includes(c.toUpperCase()))) score += 20;
  if (t.matchKeywords.some((k) => msg.includes(k.toLowerCase()))) score += 15;
  if (cat && t.matchCategories.some((c) => cat.includes(c.toLowerCase()))) score += 10;
  if (comp && t.matchCategories.some((c) => comp.includes(c))) score += 5;
  if (t.matchCodes.length === 0 && t.matchKeywords.length === 0 && t.matchCategories.length > 0 && cat && t.matchCategories.some((c) => cat.includes(c))) score += 8;
  return score;
}

/**
 * Suggests auto-fix options from problem context. Deterministic; no external calls.
 */
export function suggestAutoFix(input: SuggestAutoFixInput): SuggestAutoFixOutput {
  const ctx = input.problemContext && typeof input.problemContext === "object" ? input.problemContext : {};
  const triedSet = new Set(
    Array.isArray(input.fixesAlreadyTried) ? input.fixesAlreadyTried.map((id) => String(id).trim()).filter(Boolean) : []
  );
  const max = Math.max(1, Math.min(10, Math.floor(Number(input.maxSuggestions) || 5)));
  const isEn = input.locale === "en";

  const scored = FIX_TEMPLATES.filter((t) => !triedSet.has(t.fixId)).map((t) => ({
    template: t,
    score: scoreMatch(ctx, t),
  }));

  scored.sort((a, b) => b.score - a.score);
  const fallback = FIX_TEMPLATES.find((t) => t.fixId === "generic-runtime");
  const selected = scored.slice(0, max).map(({ template }) => template);
  if (selected.length === 0 && fallback && !triedSet.has(fallback.fixId)) selected.push(fallback);

  const suggestions: AutoFixSuggestion[] = selected.map((t) => {
    const loc = isEn ? t.en : t.nb;
    return {
      fixId: t.fixId,
      title: loc.title,
      description: loc.description ?? undefined,
      steps: loc.steps,
      command: loc.command ?? undefined,
      riskLevel: t.riskLevel,
      category: t.category,
    };
  });

  const summary = isEn
    ? `Suggested ${suggestions.length} possible fix(es) for the reported problem.`
    : `Foreslo ${suggestions.length} mulig(e) reparasjon(er) for problemet.`;

  return {
    suggestions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { suggestAutoFixCapability, CAPABILITY_NAME };

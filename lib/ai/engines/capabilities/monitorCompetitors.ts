/**
 * Competitor monitoring AI capability: monitorCompetitors.
 * Produces a monitoring plan per competitor (what to track: pricing, features, SERP, content,
 * positioning) and optionally evaluates current signals vs previous snapshot to report changes.
 * Does not fetch external data; consumes provided competitor list and optional snapshots.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "monitorCompetitors";

const monitorCompetitorsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Competitor monitoring AI: produces a monitoring plan per competitor (pricing, features, SERP, content, positioning) and optional change detection when previous snapshot and current signals are provided. Does not fetch data; plan and diff are deterministic from inputs. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Monitor competitors input",
    properties: {
      competitors: {
        type: "array",
        description: "List of competitors to monitor (id, name, optional domain)",
        items: {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            domain: { type: "string" },
          },
        },
      },
      checkTypes: {
        type: "array",
        description: "Types of checks to include: pricing, features, serp, content, positioning",
        items: { type: "string", enum: ["pricing", "features", "serp", "content", "positioning"] },
      },
      previousSnapshot: {
        type: "array",
        description: "Previous observed values for change detection (competitorId, metric, value, observedAt)",
        items: {
          type: "object",
          properties: {
            competitorId: { type: "string" },
            metric: { type: "string" },
            value: { type: "string" },
            observedAt: { type: "string" },
          },
        },
      },
      currentSignals: {
        type: "array",
        description: "Current observed values (same shape as previousSnapshot)",
        items: {
          type: "object",
          properties: {
            competitorId: { type: "string" },
            metric: { type: "string" },
            value: { type: "string" },
            observedAt: { type: "string" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for plan and messages" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Competitor monitoring result",
    required: ["monitoringPlan", "changes", "summary", "monitoredAt"],
    properties: {
      monitoringPlan: {
        type: "array",
        items: {
          type: "object",
          required: ["competitorId", "competitorName", "checks"],
          properties: {
            competitorId: { type: "string" },
            competitorName: { type: "string" },
            domain: { type: "string" },
            checks: {
              type: "array",
              items: {
                type: "object",
                required: ["type", "priority", "suggestion"],
                properties: {
                  type: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  suggestion: { type: "string" },
                },
              },
            },
          },
        },
      },
      changes: {
        type: "array",
        description: "Detected changes when previousSnapshot and currentSignals provided",
        items: {
          type: "object",
          required: ["competitorId", "metric", "previousValue", "currentValue", "detectedAt"],
          properties: {
            competitorId: { type: "string" },
            metric: { type: "string" },
            previousValue: { type: "string" },
            currentValue: { type: "string" },
            observedAt: { type: "string" },
            detectedAt: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      monitoredAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is plan and diff only; does not fetch or mutate external data.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(monitorCompetitorsCapability);

export type CompetitorInput = {
  id: string;
  name: string;
  domain?: string | null;
};

export type SnapshotEntry = {
  competitorId: string;
  metric: string;
  value: string;
  observedAt?: string | null;
};

export type MonitorCompetitorsInput = {
  competitors?: CompetitorInput[] | null;
  checkTypes?: ("pricing" | "features" | "serp" | "content" | "positioning")[] | null;
  previousSnapshot?: SnapshotEntry[] | null;
  currentSignals?: SnapshotEntry[] | null;
  locale?: "nb" | "en" | null;
};

export type MonitoringCheck = {
  type: string;
  priority: "high" | "medium" | "low";
  suggestion: string;
};

export type CompetitorMonitoringPlan = {
  competitorId: string;
  competitorName: string;
  domain: string;
  checks: MonitoringCheck[];
};

export type CompetitorChange = {
  competitorId: string;
  metric: string;
  previousValue: string;
  currentValue: string;
  observedAt?: string | null;
  detectedAt: string;
};

export type MonitorCompetitorsOutput = {
  monitoringPlan: CompetitorMonitoringPlan[];
  changes: CompetitorChange[];
  summary: string;
  monitoredAt: string;
};

const DEFAULT_CHECK_TYPES = ["pricing", "features", "serp", "content", "positioning"] as const;

function buildChecks(
  competitor: CompetitorInput,
  checkTypes: readonly string[],
  isEn: boolean
): MonitoringCheck[] {
  const name = competitor.name || competitor.id;
  const domain = competitor.domain ? ` (${competitor.domain})` : "";
  const checks: MonitoringCheck[] = [];
  const high = ["pricing", "serp"];
  const medium = ["features", "positioning"];
  const low = ["content"];

  const copy: Record<string, { en: string; nb: string }> = {
    pricing: {
      en: `Track pricing and plans for ${name}${domain}. Compare with your offering.`,
      nb: `Spor priser og planer for ${name}${domain}. Sammenlign med ditt tilbud.`,
    },
    features: {
      en: `Monitor feature set and product updates for ${name}.`,
      nb: `Overvåk funksjonssett og produktoppdateringer for ${name}.`,
    },
    serp: {
      en: `Check SERP visibility for shared keywords: rankings and snippet changes for ${name}.`,
      nb: `Sjekk SERP-synlighet for felles nøkkelord: rangering og snippet-endringer for ${name}.`,
    },
    content: {
      en: `Review new or updated content (blog, guides, landing pages) for ${name}.`,
      nb: `Gjennomgå nytt eller oppdatert innhold (blogg, guider, landingssider) for ${name}.`,
    },
    positioning: {
      en: `Track messaging and positioning changes (value prop, tone) for ${name}.`,
      nb: `Spor budskaps- og posisjoneringsendringer (verdiforslag, tone) for ${name}.`,
    },
  };

  for (const type of checkTypes) {
    const c = copy[type];
    if (!c) continue;
    const priority: "high" | "medium" | "low" = high.includes(type) ? "high" : medium.includes(type) ? "medium" : "low";
    checks.push({
      type,
      priority,
      suggestion: isEn ? c.en : c.nb,
    });
  }
  return checks;
}

/**
 * Produces competitor monitoring plan and optional change list. Deterministic; no external calls.
 */
export function monitorCompetitors(input: MonitorCompetitorsInput = {}): MonitorCompetitorsOutput {
  const competitors = Array.isArray(input.competitors) ? input.competitors : [];
  const checkTypes =
    Array.isArray(input.checkTypes) && input.checkTypes.length > 0
      ? input.checkTypes
      : [...DEFAULT_CHECK_TYPES];
  const previous = Array.isArray(input.previousSnapshot) ? input.previousSnapshot : [];
  const current = Array.isArray(input.currentSignals) ? input.currentSignals : [];
  const isEn = input.locale === "en";

  const monitoringPlan: CompetitorMonitoringPlan[] = competitors.map((c) => {
    const competitorId = String(c.id ?? "").trim() || "unknown";
    const competitorName = String(c.name ?? "").trim() || (c.id ?? "Unknown");
    const domain = String(c.domain ?? "").trim();
    return {
      competitorId,
      competitorName,
      domain,
      checks: buildChecks(c, checkTypes, isEn),
    };
  });

  const prevMap = new Map<string, SnapshotEntry>();
  for (const e of previous) {
    const key = `${e.competitorId}\t${e.metric}`;
    if (!prevMap.has(key)) prevMap.set(key, e);
  }

  const changes: CompetitorChange[] = [];
  const now = new Date().toISOString();
  for (const cur of current) {
    const key = `${cur.competitorId}\t${cur.metric}`;
    const prev = prevMap.get(key);
    const prevVal = prev?.value ?? "";
    const curVal = typeof cur.value === "string" ? cur.value : String(cur.value ?? "");
    if (prevVal !== curVal) {
      changes.push({
        competitorId: cur.competitorId,
        metric: cur.metric,
        previousValue: prevVal,
        currentValue: curVal,
        observedAt: cur.observedAt ?? undefined,
        detectedAt: now,
      });
    }
  }

  const changeCount = changes.length;
  const compCount = monitoringPlan.length;
  const summary = isEn
    ? `Monitoring plan for ${compCount} competitor(s). ${changeCount > 0 ? `${changeCount} change(s) detected vs previous snapshot.` : "No changes detected (or no snapshot comparison)."}`
    : `Overvåkingsplan for ${compCount} konkurrent(er). ${changeCount > 0 ? `${changeCount} endring(er) oppdaget mot forrige snapshot.` : "Ingen endringer oppdaget (eller ingen snapshot-sammenligning)."}`;

  return {
    monitoringPlan,
    changes,
    summary,
    monitoredAt: now,
  };
}

export { monitorCompetitorsCapability, CAPABILITY_NAME };

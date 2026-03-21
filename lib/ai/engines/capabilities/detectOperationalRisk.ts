/**
 * Operational risk detector capability: detectOperationalRisk.
 * Detects operational risks from incidents, dependencies, capacity, compliance, and single points of failure.
 * Returns risks with category, severity, and mitigation suggestions. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectOperationalRisk";

const detectOperationalRiskCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects operational risks from incidents, dependencies, capacity, compliance signals, and single points of failure. Returns risks with category, severity, description, and mitigation. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Operational risk detection input",
    properties: {
      incidents: {
        type: "array",
        description: "Recent incident summary",
        items: {
          type: "object",
          properties: {
            category: { type: "string", description: "e.g. availability, security, data" },
            count: { type: "number" },
            severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          },
        },
      },
      dependencies: {
        type: "array",
        description: "Critical dependencies (e.g. DB, API, third-party)",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            critical: { type: "boolean" },
            hasFallback: { type: "boolean" },
          },
        },
      },
      capacitySignals: {
        type: "object",
        properties: {
          utilisationPercent: { type: "number", description: "0-100" },
          headroomPercent: { type: "number" },
        },
      },
      singlePointsOfFailure: { type: "array", items: { type: "string" } },
      complianceSignals: {
        type: "array",
        description: "e.g. cert expiry, audit gaps",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            expiresAt: { type: "string" },
            gap: { type: "string" },
          },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
  },
  outputSchema: {
    type: "object",
    description: "Operational risk detection result",
    required: ["risks", "overallLevel", "mitigations", "summary", "generatedAt"],
    properties: {
      risks: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "category", "severity", "description", "mitigation"],
          properties: {
            id: { type: "string" },
            category: { type: "string", enum: ["availability", "dependency", "capacity", "compliance", "security", "other"] },
            severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
            description: { type: "string" },
            mitigation: { type: "string" },
          },
        },
      },
      overallLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
      mitigations: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is detection only; no operational or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(detectOperationalRiskCapability);

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type IncidentInput = {
  category?: string | null;
  count?: number | null;
  severity?: string | null;
};

export type DependencyInput = {
  name?: string | null;
  critical?: boolean | null;
  hasFallback?: boolean | null;
};

export type ComplianceSignalInput = {
  type?: string | null;
  expiresAt?: string | null;
  gap?: string | null;
};

export type DetectOperationalRiskInput = {
  incidents?: IncidentInput[] | null;
  dependencies?: DependencyInput[] | null;
  capacitySignals?: { utilisationPercent?: number | null; headroomPercent?: number | null } | null;
  singlePointsOfFailure?: string[] | null;
  complianceSignals?: ComplianceSignalInput[] | null;
  locale?: "nb" | "en" | null;
};

export type OperationalRisk = {
  id: string;
  category: "availability" | "dependency" | "capacity" | "compliance" | "security" | "other";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  mitigation: string;
};

export type DetectOperationalRiskOutput = {
  risks: OperationalRisk[];
  overallLevel: "low" | "medium" | "high" | "critical";
  mitigations: string[];
  summary: string;
  generatedAt: string;
};

/**
 * Detects operational risks from signals. Deterministic; no external calls.
 */
export function detectOperationalRisk(input: DetectOperationalRiskInput): DetectOperationalRiskOutput {
  const isEn = input.locale === "en";
  const risks: OperationalRisk[] = [];
  const mitigations: string[] = [];
  let idSeq = 1;

  const incidents = Array.isArray(input.incidents) ? input.incidents.filter((i) => i && typeof i === "object") : [];
  const criticalIncidents = incidents.filter((i) => safeStr(i.severity) === "critical" || (safeNum(i.count) > 2 && safeStr(i.severity) === "high"));
  if (criticalIncidents.length > 0) {
    const cat = criticalIncidents[0].category ? safeStr(criticalIncidents[0].category) : "availability";
    const category = ["availability", "dependency", "capacity", "compliance", "security", "other"].includes(cat) ? cat : "availability";
    risks.push({
      id: `risk-${idSeq++}`,
      category: category as OperationalRisk["category"],
      severity: "critical",
      description: isEn ? "Recurring high or critical incidents; operational stability at risk." : "Gjentakende høye eller kritiske hendelser; operativ stabilitet i fare.",
      mitigation: isEn ? "Root-cause analysis; implement fixes and monitoring; define runbooks." : "Rotårsaksanalyse; implementer rettinger og overvåking; definer runbooks.",
    });
    mitigations.push(isEn ? "Prioritize incident reduction and post-mortems." : "Prioriter hendelsesreduksjon og post-mortems.");
  }

  const deps = Array.isArray(input.dependencies) ? input.dependencies.filter((d) => d && typeof d === "object") : [];
  for (const d of deps) {
    if (d.critical === true && d.hasFallback !== true) {
      const name = safeStr(d.name) || "dependency";
      risks.push({
        id: `risk-${idSeq++}`,
        category: "dependency",
        severity: "high",
        description: isEn ? `Critical dependency "${name}" has no fallback; single point of failure.` : `Kritisk avhengighet «${name}» har ingen fallback; enkelt feilpunkt.`,
        mitigation: isEn ? "Introduce fallback, circuit breaker, or redundancy; document recovery." : "Innfør fallback, circuit breaker eller redundans; dokumenter gjenoppretting.",
      });
    }
  }

  const spof = Array.isArray(input.singlePointsOfFailure) ? input.singlePointsOfFailure.map(safeStr).filter(Boolean) : [];
  for (const s of spof) {
    risks.push({
      id: `risk-${idSeq++}`,
      category: "availability",
      severity: "high",
      description: isEn ? `Single point of failure: ${s}.` : `Enkelt feilpunkt: ${s}.`,
      mitigation: isEn ? "Add redundancy, failover, or eliminate SPOF; test failover regularly." : "Legg til redundans, failover eller eliminer SPOF; test failover regelmessig.",
    });
  }
  if (spof.length > 0) {
    mitigations.push(isEn ? "Address single points of failure; document and test recovery." : "Adresser enkelt feilpunkter; dokumenter og test gjenoppretting.");
  }

  const cap = input.capacitySignals && typeof input.capacitySignals === "object" ? input.capacitySignals : null;
  const utilisation = cap?.utilisationPercent != null ? safeNum(cap.utilisationPercent) : 0;
  const headroom = cap?.headroomPercent != null ? safeNum(cap.headroomPercent) : 100;
  if (utilisation >= 85 || headroom < 15) {
    risks.push({
      id: `risk-${idSeq++}`,
      category: "capacity",
      severity: utilisation >= 95 ? "critical" : "high",
      description: isEn ? `Capacity utilisation high (${utilisation}%); low headroom (${headroom}%).` : `Kapasitetsutnyttelse høy (${utilisation}%); liten reserve (${headroom}%).`,
      mitigation: isEn ? "Scale up or out before peak; set alerts and capacity planning." : "Skaler opp eller ut før topp; sett varsler og kapasitetsplanlegging.",
    });
    mitigations.push(isEn ? "Review capacity and scaling triggers." : "Gjennomgå kapasitet og skaleringsutløsere.");
  }

  const compliance = Array.isArray(input.complianceSignals) ? input.complianceSignals.filter((c) => c && typeof c === "object") : [];
  for (const c of compliance) {
    if (safeStr(c.gap)) {
      risks.push({
        id: `risk-${idSeq++}`,
        category: "compliance",
        severity: "medium",
        description: isEn ? `Compliance gap: ${safeStr(c.gap)}.` : `Compliance-gap: ${safeStr(c.gap)}.`,
        mitigation: isEn ? "Close gap; document controls and evidence." : "Lukk gapet; dokumenter kontroller og bevis.",
      });
    }
    if (safeStr(c.expiresAt)) {
      const exp = safeStr(c.expiresAt);
      risks.push({
        id: `risk-${idSeq++}`,
        category: "compliance",
        severity: "medium",
        description: isEn ? `Compliance or cert expiry: ${exp}.` : `Compliance- eller sertifikatutløp: ${exp}.`,
        mitigation: isEn ? "Renew before expiry; set reminder and ownership." : "Forny før utløp; sett påminnelse og eierskap.",
      });
    }
  }

  const criticalCount = risks.filter((r) => r.severity === "critical").length;
  const highCount = risks.filter((r) => r.severity === "high").length;
  const overallLevel: DetectOperationalRiskOutput["overallLevel"] =
    criticalCount > 0 ? "critical" : highCount >= 2 ? "high" : highCount >= 1 ? "high" : risks.length > 0 ? "medium" : "low";

  const summary = isEn
    ? `Operational risk: ${overallLevel}. ${risks.length} risk(s) detected (${criticalCount} critical, ${highCount} high).`
    : `Operativ risiko: ${overallLevel}. ${risks.length} risiko(er) oppdaget (${criticalCount} kritiske, ${highCount} høye).`;

  return {
    risks,
    overallLevel,
    mitigations: [...new Set(mitigations)],
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { detectOperationalRiskCapability, CAPABILITY_NAME };

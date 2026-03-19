/**
 * Industry signal monitor capability: monitorIndustrySignals.
 * Monitors industry signals (regulatory, demand, supply, sentiment, events) and returns
 * categorized signals, alert levels, trend hints, and recommendations. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "monitorIndustrySignals";

const monitorIndustrySignalsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Monitors industry signals: regulatory, demand, supply, sentiment, and events. Returns categorized signals, alert levels, trend hints, and recommendations. Consumes provided signal list; does not fetch external data. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Industry signal monitoring input",
    properties: {
      industry: { type: "string", description: "Industry context (e.g. food_service, catering, b2b)" },
      signals: {
        type: "array",
        description: "Observed signals to monitor",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["regulatory", "demand", "supply", "sentiment", "event"] },
            source: { type: "string", description: "e.g. government, survey, news" },
            summary: { type: "string" },
            value: { type: "string", description: "Optional metric or label" },
            observedAt: { type: "string", description: "ISO date" },
            severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          },
        },
      },
      watchlist: {
        type: "array",
        description: "Signal types or keywords to highlight",
        items: { type: "string" },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["signals"],
  },
  outputSchema: {
    type: "object",
    description: "Industry signal monitoring result",
    required: ["monitoredSignals", "alerts", "trendHints", "recommendations", "summary", "generatedAt"],
    properties: {
      monitoredSignals: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "summary", "alertLevel", "category"],
          properties: {
            type: { type: "string" },
            source: { type: "string" },
            summary: { type: "string" },
            value: { type: "string" },
            observedAt: { type: "string" },
            alertLevel: { type: "string", enum: ["info", "low", "medium", "high", "critical"] },
            category: { type: "string" },
          },
        },
      },
      alerts: { type: "array", items: { type: "object", properties: { signalIndex: { type: "number" }, reason: { type: "string" }, alertLevel: { type: "string" } } } },
      trendHints: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is monitoring/analysis only; no external fetch or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(monitorIndustrySignalsCapability);

const SIGNAL_TYPES = ["regulatory", "demand", "supply", "sentiment", "event"] as const;
const SEVERITY_TO_ALERT: Record<string, "info" | "low" | "medium" | "high" | "critical"> = {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export type IndustrySignalInput = {
  type?: string | null;
  source?: string | null;
  summary?: string | null;
  value?: string | null;
  observedAt?: string | null;
  severity?: string | null;
};

export type MonitorIndustrySignalsInput = {
  industry?: string | null;
  signals: IndustrySignalInput[];
  watchlist?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type MonitoredSignal = {
  type: string;
  source: string;
  summary: string;
  value: string;
  observedAt: string;
  alertLevel: "info" | "low" | "medium" | "high" | "critical";
  category: string;
};

export type SignalAlert = {
  signalIndex: number;
  reason: string;
  alertLevel: string;
};

export type MonitorIndustrySignalsOutput = {
  monitoredSignals: MonitoredSignal[];
  alerts: SignalAlert[];
  trendHints: string[];
  recommendations: string[];
  summary: string;
  generatedAt: string;
};

function categoryLabel(type: string, isEn: boolean): string {
  const t = type.toLowerCase();
  if (t === "regulatory") return isEn ? "Regulatory" : "Regulatorisk";
  if (t === "demand") return isEn ? "Demand" : "Etterspørsel";
  if (t === "supply") return isEn ? "Supply" : "Tilbud";
  if (t === "sentiment") return isEn ? "Sentiment" : "Sentiment";
  if (t === "event") return isEn ? "Event" : "Hendelse";
  return type;
}

/**
 * Monitors industry signals and produces alerts and trend hints. Deterministic; no external calls.
 */
export function monitorIndustrySignals(input: MonitorIndustrySignalsInput): MonitorIndustrySignalsOutput {
  const isEn = input.locale === "en";
  const industry = safeStr(input.industry);
  const signals = Array.isArray(input.signals) ? input.signals.filter((s) => s && typeof s === "object") : [];
  const watchlist = Array.isArray(input.watchlist) ? input.watchlist.map(safeStr).filter(Boolean) : [];

  const monitoredSignals: MonitoredSignal[] = [];
  const alerts: SignalAlert[] = [];
  const trendHints: string[] = [];
  const recommendations: string[] = [];

  let regulatoryCount = 0;
  let demandCount = 0;
  let supplyCount = 0;
  let highOrCriticalCount = 0;

  for (let i = 0; i < signals.length; i++) {
    const s = signals[i];
    const type = SIGNAL_TYPES.includes(s.type as (typeof SIGNAL_TYPES)[number]) ? s.type : "event";
    const source = safeStr(s.source);
    const summary = safeStr(s.summary) || (isEn ? "No summary" : "Ingen oppsummering");
    const value = safeStr(s.value);
    const observedAt = safeStr(s.observedAt);
    const severity = safeStr(s.severity);

    const alertLevel = severity && SEVERITY_TO_ALERT[severity]
      ? SEVERITY_TO_ALERT[severity]
      : type === "regulatory"
        ? "medium"
        : type === "event"
          ? "low"
          : "info";

    if (alertLevel === "high" || alertLevel === "critical") highOrCriticalCount++;
    if (type === "regulatory") regulatoryCount++;
    if (type === "demand") demandCount++;
    if (type === "supply") supplyCount++;

    const category = categoryLabel(type, isEn);

    monitoredSignals.push({
      type,
      source,
      summary,
      value,
      observedAt,
      alertLevel,
      category,
    });

    const onWatchlist = watchlist.some((w) => summary.toLowerCase().includes(w) || type.toLowerCase().includes(w));
    const onWatchlistNonInfo =
      onWatchlist &&
      (alertLevel === "low" || alertLevel === "medium" || alertLevel === "high" || alertLevel === "critical");
    if (alertLevel === "high" || alertLevel === "critical" || onWatchlistNonInfo) {
      const reason =
        alertLevel === "high" || alertLevel === "critical"
          ? (isEn ? `Severity: ${alertLevel}` : `Alvorlighet: ${alertLevel}`)
          : (isEn ? "Matches watchlist" : "Matcher overvåkningsliste");
      alerts.push({ signalIndex: i, reason, alertLevel });
    }
  }

  if (regulatoryCount > 0) {
    trendHints.push(isEn ? `${regulatoryCount} regulatory signal(s); review compliance impact.` : `${regulatoryCount} regulatorisk(e) signal(er); vurder compliance-påvirkning.`);
    recommendations.push(isEn ? "Track regulatory changes; update policies if needed." : "Følg regulatoriske endringer; oppdater retningslinjer ved behov.");
  }
  if (demandCount > 1) {
    trendHints.push(isEn ? "Multiple demand signals; aggregate for trend view." : "Flere etterspørselssignaler; aggreger for trendvisning.");
  }
  if (supplyCount > 0) {
    trendHints.push(isEn ? "Supply-side signals present; monitor cost and availability." : "Tilbudssignaler til stede; overvåk kostnad og tilgjengelighet.");
  }
  if (highOrCriticalCount > 0) {
    recommendations.push(isEn ? "Prioritize high/critical alerts; assign ownership and response." : "Prioriter høye/kritiske varsler; tildel ansvar og respons.");
  }
  if (industry) {
    trendHints.push(isEn ? `Industry context: ${industry}. Use for interpretation.` : `Bransjekontekst: ${industry}. Bruk ved tolkning.`);
  }

  const summary = isEn
    ? `Industry signals: ${monitoredSignals.length} monitored, ${alerts.length} alert(s). ${trendHints.length} trend hint(s), ${recommendations.length} recommendation(s).`
    : `Bransjesignaler: ${monitoredSignals.length} overvåket, ${alerts.length} varsel. ${trendHints.length} trendhint, ${recommendations.length} anbefaling(er).`;

  return {
    monitoredSignals,
    alerts,
    trendHints,
    recommendations,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { monitorIndustrySignalsCapability, CAPABILITY_NAME };

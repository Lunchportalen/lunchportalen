/**
 * Platform efficiency analyzer capability: optimizePlatformPerformance.
 * Analyzes platform performance metrics and suggests optimizations for latency, throughput, and resource use.
 * Returns efficiency score, prioritized optimizations, and recommendations. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "optimizePlatformPerformance";

const optimizePlatformPerformanceCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Analyzes platform performance from latency, throughput, and resource metrics. Returns efficiency score, prioritized optimizations (current vs target), and recommendations. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Platform performance optimization input",
    properties: {
      metrics: {
        type: "object",
        description: "Performance and resource metrics",
        properties: {
          latencyMsP50: { type: "number" },
          latencyMsP95: { type: "number" },
          latencyMsP99: { type: "number" },
          throughputRps: { type: "number", description: "Requests per second" },
          cpuPercent: { type: "number", description: "0-100" },
          memoryPercent: { type: "number", description: "0-100" },
          dbQueryMsP95: { type: "number", description: "Database query P95 ms" },
          cacheHitRate: { type: "number", description: "0-1 or 0-100" },
        },
      },
      bottlenecks: {
        type: "array",
        description: "Known bottleneck hints (name, type, impact)",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { type: "string", enum: ["cpu", "memory", "io", "network", "database", "cache"] },
            impact: { type: "string", enum: ["low", "medium", "high"] },
          },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
  },
  outputSchema: {
    type: "object",
    description: "Platform performance optimization result",
    required: ["efficiencyScore", "optimizations", "recommendations", "summary", "generatedAt"],
    properties: {
      efficiencyScore: { type: "number", description: "0-100" },
      optimizations: {
        type: "array",
        items: {
          type: "object",
          required: ["area", "current", "target", "suggestion", "priority"],
          properties: {
            area: { type: "string" },
            current: { type: "string" },
            target: { type: "string" },
            suggestion: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
          },
        },
      },
      recommendations: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is suggestions only; no platform or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(optimizePlatformPerformanceCapability);

const LATENCY_P95_GOOD_MS = 500;
const LATENCY_P95_WARN_MS = 1500;
const CPU_WARN = 75;
const CPU_CRITICAL = 90;
const MEMORY_WARN = 80;
const MEMORY_CRITICAL = 95;
const DB_QUERY_WARN_MS = 200;
const DB_QUERY_CRITICAL_MS = 1000;
const CACHE_HIT_GOOD = 0.8;
const CACHE_HIT_LOW = 0.5;

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export type PerformanceMetricsInput = {
  latencyMsP50?: number | null;
  latencyMsP95?: number | null;
  latencyMsP99?: number | null;
  throughputRps?: number | null;
  cpuPercent?: number | null;
  memoryPercent?: number | null;
  dbQueryMsP95?: number | null;
  cacheHitRate?: number | null;
};

export type BottleneckInput = {
  name?: string | null;
  type?: string | null;
  impact?: string | null;
};

export type OptimizePlatformPerformanceInput = {
  metrics?: PerformanceMetricsInput | null;
  bottlenecks?: BottleneckInput[] | null;
  locale?: "nb" | "en" | null;
};

export type PerformanceOptimization = {
  area: string;
  current: string;
  target: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
};

export type OptimizePlatformPerformanceOutput = {
  efficiencyScore: number;
  optimizations: PerformanceOptimization[];
  recommendations: string[];
  summary: string;
  generatedAt: string;
};

/**
 * Analyzes platform performance and suggests optimizations. Deterministic; no external calls.
 */
export function optimizePlatformPerformance(input: OptimizePlatformPerformanceInput): OptimizePlatformPerformanceOutput {
  const isEn = input.locale === "en";
  const m = input.metrics && typeof input.metrics === "object" ? input.metrics : {};
  const bottlenecks = Array.isArray(input.bottlenecks) ? input.bottlenecks.filter((b) => b && typeof b === "object") : [];

  const latencyP95 = safeNum(m.latencyMsP95);
  const cpu = safeNum(m.cpuPercent);
  const memory = safeNum(m.memoryPercent);
  const dbQueryP95 = safeNum(m.dbQueryMsP95);
  const cacheHitRaw = safeNum(m.cacheHitRate);
  const cacheHit = cacheHitRaw > 1 ? cacheHitRaw / 100 : cacheHitRaw;

  const optimizations: PerformanceOptimization[] = [];
  const recommendations: string[] = [];
  let score = 100;

  if (latencyP95 > 0) {
    if (latencyP95 > LATENCY_P95_WARN_MS) {
      optimizations.push({
        area: "latency",
        current: `${latencyP95}ms P95`,
        target: isEn ? `< ${LATENCY_P95_GOOD_MS}ms P95` : `< ${LATENCY_P95_GOOD_MS}ms P95`,
        suggestion: isEn ? "Review slow endpoints; add caching, indexing, or connection pooling." : "Gjennomgå trege endepunkter; legg til caching, indeksering eller connection pooling.",
        priority: latencyP95 > LATENCY_P95_WARN_MS * 2 ? "high" : "medium",
      });
      score -= latencyP95 > LATENCY_P95_WARN_MS * 2 ? 20 : 10;
    }
  }

  if (cpu > 0) {
    if (cpu >= CPU_CRITICAL) {
      optimizations.push({
        area: "cpu",
        current: `${cpu}%`,
        target: "< 90%",
        suggestion: isEn ? "Reduce CPU load: optimize hot paths, scale horizontally, or profile and fix bottlenecks." : "Reduser CPU-belastning: optimaliser kritiske stier, skaler horisontalt, eller profil og fiks flaskehalser.",
        priority: "high",
      });
      score -= 15;
    } else if (cpu >= CPU_WARN) {
      optimizations.push({
        area: "cpu",
        current: `${cpu}%`,
        target: isEn ? "< 75%" : "< 75%",
        suggestion: isEn ? "Monitor CPU; consider optimization or scaling before peak." : "Overvåk CPU; vurder optimalisering eller skalering før topp.",
        priority: "medium",
      });
      score -= 8;
    }
  }

  if (memory > 0) {
    if (memory >= MEMORY_CRITICAL) {
      optimizations.push({
        area: "memory",
        current: `${memory}%`,
        target: isEn ? "< 95%" : "< 95%",
        suggestion: isEn ? "Reduce memory usage or scale; check for leaks and large caches." : "Reduser minnebruk eller skaler; sjekk lekkasjer og store cacher.",
        priority: "high",
      });
      score -= 15;
    } else if (memory >= MEMORY_WARN) {
      optimizations.push({
        area: "memory",
        current: `${memory}%`,
        target: isEn ? "< 80%" : "< 80%",
        suggestion: isEn ? "Monitor memory; tune cache sizes and object lifecycle." : "Overvåk minne; juster cache-størrelser og objektlivssyklus.",
        priority: "medium",
      });
      score -= 5;
    }
  }

  if (dbQueryP95 > 0) {
    if (dbQueryP95 >= DB_QUERY_CRITICAL_MS) {
      optimizations.push({
        area: "database",
        current: `${dbQueryP95}ms P95`,
        target: `< ${DB_QUERY_WARN_MS}ms`,
        suggestion: isEn ? "Optimize slow queries: add indexes, avoid N+1, use read replicas or caching." : "Optimaliser trege spørringer: legg til indekser, unngå N+1, bruk lesereplika eller caching.",
        priority: "high",
      });
      score -= 15;
    } else if (dbQueryP95 >= DB_QUERY_WARN_MS) {
      optimizations.push({
        area: "database",
        current: `${dbQueryP95}ms P95`,
        target: `< ${DB_QUERY_WARN_MS}ms`,
        suggestion: isEn ? "Review query patterns; add indexes for frequent filters and sorts." : "Gjennomgå spørremønstre; legg til indekser for hyppige filtre og sorteringer.",
        priority: "medium",
      });
      score -= 8;
    }
  }

  if (cacheHit > 0 && cacheHit < CACHE_HIT_LOW) {
    optimizations.push({
      area: "cache",
      current: `${(cacheHit * 100).toFixed(1)}% hit rate`,
      target: isEn ? `> ${CACHE_HIT_GOOD * 100}%` : `> ${CACHE_HIT_GOOD * 100}%`,
      suggestion: isEn ? "Improve cache hit rate: tune TTL, warm critical paths, or expand cache keys." : "Forbedre cache-treff: juster TTL, varm kritiske stier, eller utvid cache-nøkler.",
      priority: "medium",
    });
    score -= 10;
  }

  for (const b of bottlenecks) {
    const type = safeStr(b.type);
    const impact = safeStr(b.impact);
    const name = safeStr(b.name) || type;
    if (impact === "high" && !optimizations.some((o) => o.area === type)) {
      optimizations.push({
        area: type || "bottleneck",
        current: name,
        target: isEn ? "Resolve or mitigate" : "Løs eller demp",
        suggestion: isEn ? `Address reported bottleneck: ${name}. Profile and optimize.` : `Adresser rapportert flaskehals: ${name}. Profiler og optimaliser.`,
        priority: "high",
      });
      score -= 10;
    }
  }

  const efficiencyScore = Math.max(0, Math.min(100, score));

  if (optimizations.some((o) => o.priority === "high")) {
    recommendations.push(isEn ? "Tackle high-priority optimizations first; measure before and after." : "Ta høyprioriterte optimaliseringer først; mål før og etter.");
  }
  if (optimizations.length === 0) {
    recommendations.push(isEn ? "No major issues detected; continue monitoring and set baselines." : "Ingen store problemer funnet; fortsett overvåking og sett baselinjer.");
  }
  recommendations.push(isEn ? "Use structured metrics (P50/P95/P99) for consistent comparison." : "Bruk strukturerte måltall (P50/P95/P99) for konsistent sammenligning.");

  const summary = isEn
    ? `Platform performance: efficiency score ${efficiencyScore}/100. ${optimizations.length} optimization(s) suggested.`
    : `Plattformytelse: effektivitets-score ${efficiencyScore}/100. ${optimizations.length} optimalisering(er) foreslått.`;

  return {
    efficiencyScore,
    optimizations,
    recommendations,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { optimizePlatformPerformanceCapability, CAPABILITY_NAME };

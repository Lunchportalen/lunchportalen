/**
 * Aggregerte målinger for AI CEO + læring (kun lokalt, forklarbar telling).
 */

export type ObjectionMetricsBucket = {
  /** Antall «Analyser svar»-kjøringer */
  analysisRuns: number;
  /** Treff på kantine/egen lunsj-innvending */
  canteenDetections: number;
  /** Manuelt loggførte «interessert catering» etter pivot-kontekst */
  cateringConversions: number;
  /** Bekreftede pivot (én per hendelse, ikke per lead-dedupe her) */
  pivotAppliedCount: number;
  /** Læring: pivot bekreftet per innvendings-id */
  pivotByObjectionId: Record<string, number>;
};

const KEY = "lp_outbound_objection_metrics_v1";

function defaultBucket(): ObjectionMetricsBucket {
  return {
    analysisRuns: 0,
    canteenDetections: 0,
    cateringConversions: 0,
    pivotAppliedCount: 0,
    pivotByObjectionId: {},
  };
}

function read(): ObjectionMetricsBucket {
  if (typeof window === "undefined") return defaultBucket();
  try {
    const raw = window.localStorage.getItem(KEY);
    const v = JSON.parse(raw ?? "null") as unknown;
    if (!v || typeof v !== "object") return defaultBucket();
    const o = v as Partial<ObjectionMetricsBucket>;
    return {
      analysisRuns: typeof o.analysisRuns === "number" ? o.analysisRuns : 0,
      canteenDetections: typeof o.canteenDetections === "number" ? o.canteenDetections : 0,
      cateringConversions: typeof o.cateringConversions === "number" ? o.cateringConversions : 0,
      pivotAppliedCount: typeof o.pivotAppliedCount === "number" ? o.pivotAppliedCount : 0,
      pivotByObjectionId:
        o.pivotByObjectionId && typeof o.pivotByObjectionId === "object" ? { ...o.pivotByObjectionId } : {},
    };
  } catch {
    return defaultBucket();
  }
}

function write(b: ObjectionMetricsBucket): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* ignore */
  }
}

function bumpMetricsTick(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("lp-outbound-metrics"));
}

/** Kall for hver analyse av innkommende svar-tekst. */
export function recordOutboundReplyAnalysis(detected: string | null): void {
  const b = read();
  b.analysisRuns += 1;
  if (detected === "has_canteen") {
    b.canteenDetections += 1;
  }
  write(b);
  bumpMetricsTick();
}

/** Når bruker bekrefter pivot (én gang per lead håndheves i conversationStorage). */
export function recordPivotApplied(objectionId: string): void {
  const b = read();
  b.pivotAppliedCount += 1;
  b.pivotByObjectionId[objectionId] = (b.pivotByObjectionId[objectionId] ?? 0) + 1;
  write(b);
  bumpMetricsTick();
}

export function recordCateringConversionLogged(): void {
  const b = read();
  b.cateringConversions += 1;
  write(b);
  bumpMetricsTick();
}

export type OutboundObjectionSnapshot = {
  analysisRuns: number;
  canteenDetections: number;
  cateringConversions: number;
  pivotAppliedCount: number;
  pivotByObjectionId: Record<string, number>;
  /** % av analyser som traff kantine-innvending */
  pctCanteenOfAnalyses: number;
  /** % av kantine-treff som endte i loggført catering-interesse */
  pctCateringOfCanteen: number;
};

export function getOutboundObjectionSnapshot(): OutboundObjectionSnapshot {
  const b = read();
  const pctCanteenOfAnalyses =
    b.analysisRuns > 0 ? Math.round((100 * b.canteenDetections) / b.analysisRuns) : 0;
  const pctCateringOfCanteen =
    b.canteenDetections > 0 ? Math.round((100 * b.cateringConversions) / b.canteenDetections) : 0;
  return {
    ...b,
    pctCanteenOfAnalyses,
    pctCateringOfCanteen,
  };
}

/**
 * Feature-tagged CTA copy model for self-learning demo A/B.
 * Values are closed unions — extend only by widening these literals + parsers.
 */

export type DemoCtaFeatureTone = "curiosity" | "direct" | "benefit" | "urgency";

export type DemoCtaFeatureVerb = "see" | "start" | "increase" | "activate";

export type DemoCtaFeatureFraming = "result" | "process" | "question";

export type DemoCtaFeatureLength = "short" | "medium";

export type DemoCtaFeatures = {
  tone: DemoCtaFeatureTone;
  verb: DemoCtaFeatureVerb;
  framing: DemoCtaFeatureFraming;
  length: DemoCtaFeatureLength;
};

/** Traffic intent within the demo funnel (assignment + future telemetry). */
export type DemoIntentSegment = "demo_auto" | "shared_link" | "direct";

export type DemoCtaStrategyMode = "profit" | "growth" | "balance";

export type FeatureStat = { success: number; fail: number };

/**
 * Aggregated learning per feature dimension (keys = feature values, e.g. "curiosity").
 * Combo keys: `tone|verb`, `framing|tone`, `tone|verb|framing` (triple).
 */
export type FeatureLearningState = {
  tone: Record<string, FeatureStat>;
  verb: Record<string, FeatureStat>;
  framing: Record<string, FeatureStat>;
  length: Record<string, FeatureStat>;
  tone_verb: Record<string, FeatureStat>;
  framing_tone: Record<string, FeatureStat>;
  tone_verb_framing: Record<string, FeatureStat>;
};

const COMBO_SEP = "|";

export function demoCtaToneVerbKey(tone: DemoCtaFeatureTone, verb: DemoCtaFeatureVerb): string {
  return `${tone}${COMBO_SEP}${verb}`;
}

export function demoCtaFramingToneKey(framing: DemoCtaFeatureFraming, tone: DemoCtaFeatureTone): string {
  return `${framing}${COMBO_SEP}${tone}`;
}

export function demoCtaTripleKey(
  tone: DemoCtaFeatureTone,
  verb: DemoCtaFeatureVerb,
  framing: DemoCtaFeatureFraming,
): string {
  return `${tone}${COMBO_SEP}${verb}${COMBO_SEP}${framing}`;
}

export type VariantPerformanceSnapshot = {
  at: string;
  variantKey: string;
  score: number;
  impressions: number;
  confidence: number;
  device_seg?: string;
  source_seg?: string;
  intent_seg?: DemoIntentSegment;
  features?: DemoCtaFeatures;
};

export const DEMO_CTA_FEATURE_TONES: readonly DemoCtaFeatureTone[] = [
  "curiosity",
  "direct",
  "benefit",
  "urgency",
];
export const DEMO_CTA_FEATURE_VERBS: readonly DemoCtaFeatureVerb[] = ["see", "start", "increase", "activate"];
export const DEMO_CTA_FEATURE_FRAMINGS: readonly DemoCtaFeatureFraming[] = ["result", "process", "question"];
export const DEMO_CTA_FEATURE_LENGTHS: readonly DemoCtaFeatureLength[] = ["short", "medium"];

export function allDemoCtaToneVerbComboKeys(): string[] {
  const out: string[] = [];
  for (const t of DEMO_CTA_FEATURE_TONES) {
    for (const v of DEMO_CTA_FEATURE_VERBS) {
      out.push(demoCtaToneVerbKey(t, v));
    }
  }
  return out;
}

export function allDemoCtaTripleComboKeys(): string[] {
  const out: string[] = [];
  for (const t of DEMO_CTA_FEATURE_TONES) {
    for (const v of DEMO_CTA_FEATURE_VERBS) {
      for (const f of DEMO_CTA_FEATURE_FRAMINGS) {
        out.push(demoCtaTripleKey(t, v, f));
      }
    }
  }
  return out;
}

const TONES = DEMO_CTA_FEATURE_TONES;
const VERBS = DEMO_CTA_FEATURE_VERBS;
const FRAMINGS = DEMO_CTA_FEATURE_FRAMINGS;
const LENGTHS = DEMO_CTA_FEATURE_LENGTHS;

export function isDemoCtaFeatureTone(v: string): v is DemoCtaFeatureTone {
  return (TONES as readonly string[]).includes(v);
}

export function isDemoCtaFeatureVerb(v: string): v is DemoCtaFeatureVerb {
  return (VERBS as readonly string[]).includes(v);
}

export function isDemoCtaFeatureFraming(v: string): v is DemoCtaFeatureFraming {
  return (FRAMINGS as readonly string[]).includes(v);
}

export function isDemoCtaFeatureLength(v: string): v is DemoCtaFeatureLength {
  return (LENGTHS as readonly string[]).includes(v);
}

export function isDemoIntentSegment(v: string): v is DemoIntentSegment {
  return v === "demo_auto" || v === "shared_link" || v === "direct";
}

export function isDemoCtaStrategyMode(v: string): v is DemoCtaStrategyMode {
  return v === "profit" || v === "growth" || v === "balance";
}

export function parseToneVerbComboKey(key: string): { tone: DemoCtaFeatureTone; verb: DemoCtaFeatureVerb } | null {
  const parts = key.split(COMBO_SEP);
  if (parts.length !== 2) return null;
  const [tone, verb] = parts;
  if (!tone || !verb) return null;
  if (!isDemoCtaFeatureTone(tone) || !isDemoCtaFeatureVerb(verb)) return null;
  return { tone, verb };
}

export function parseTripleComboKey(key: string): {
  tone: DemoCtaFeatureTone;
  verb: DemoCtaFeatureVerb;
  framing: DemoCtaFeatureFraming;
} | null {
  const parts = key.split(COMBO_SEP);
  if (parts.length !== 3) return null;
  const [tone, verb, framing] = parts;
  if (!tone || !verb || !framing) return null;
  if (!isDemoCtaFeatureTone(tone) || !isDemoCtaFeatureVerb(verb) || !isDemoCtaFeatureFraming(framing)) {
    return null;
  }
  return { tone, verb, framing };
}

export function parseDemoCtaFeatures(raw: unknown): DemoCtaFeatures | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const tone = typeof o.tone === "string" && isDemoCtaFeatureTone(o.tone) ? o.tone : null;
  const verb = typeof o.verb === "string" && isDemoCtaFeatureVerb(o.verb) ? o.verb : null;
  const framingOk =
    typeof o.framing === "string" && isDemoCtaFeatureFraming(o.framing) ? o.framing : null;
  const length = typeof o.length === "string" && isDemoCtaFeatureLength(o.length) ? o.length : null;
  if (!tone || !verb || !framingOk || !length) return null;
  return { tone, verb, framing: framingOk, length };
}

export function emptyFeatureLearningState(): FeatureLearningState {
  return {
    tone: {},
    verb: {},
    framing: {},
    length: {},
    tone_verb: {},
    framing_tone: {},
    tone_verb_framing: {},
  };
}

export function parseFeatureLearningState(raw: unknown): FeatureLearningState {
  const empty = emptyFeatureLearningState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;
  const o = raw as Record<string, unknown>;
  const mergeDim = (dim: unknown): Record<string, FeatureStat> => {
    if (!dim || typeof dim !== "object" || Array.isArray(dim)) return {};
    const out: Record<string, FeatureStat> = {};
    for (const [k, v] of Object.entries(dim)) {
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      const s = v as Record<string, unknown>;
      const success = typeof s.success === "number" && Number.isFinite(s.success) ? Math.max(0, s.success) : 0;
      const fail = typeof s.fail === "number" && Number.isFinite(s.fail) ? Math.max(0, s.fail) : 0;
      out[k] = { success, fail };
    }
    return out;
  };
  return {
    tone: mergeDim(o.tone),
    verb: mergeDim(o.verb),
    framing: mergeDim(o.framing),
    length: mergeDim(o.length),
    tone_verb: mergeDim(o.tone_verb),
    framing_tone: mergeDim(o.framing_tone),
    tone_verb_framing: mergeDim(o.tone_verb_framing),
  };
}

export function parseVariantPerformanceHistory(raw: unknown): VariantPerformanceSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const out: VariantPerformanceSnapshot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;
    const at = typeof r.at === "string" ? r.at : "";
    const variantKey = typeof r.variantKey === "string" ? r.variantKey : "";
    const score = typeof r.score === "number" && Number.isFinite(r.score) ? r.score : NaN;
    const impressions = typeof r.impressions === "number" && Number.isFinite(r.impressions) ? r.impressions : 0;
    const confidence = typeof r.confidence === "number" && Number.isFinite(r.confidence) ? r.confidence : 0;
    if (!at || !variantKey || Number.isNaN(score)) continue;
    const device_seg = typeof r.device_seg === "string" ? r.device_seg : undefined;
    const source_seg = typeof r.source_seg === "string" ? r.source_seg : undefined;
    const intentRaw = typeof r.intent_seg === "string" ? r.intent_seg : undefined;
    const intent_seg = intentRaw && isDemoIntentSegment(intentRaw) ? intentRaw : undefined;
    const features = parseDemoCtaFeatures(r.features) ?? undefined;
    out.push({
      at,
      variantKey,
      score,
      impressions,
      confidence,
      ...(device_seg ? { device_seg } : {}),
      ...(source_seg ? { source_seg } : {}),
      ...(intent_seg ? { intent_seg } : {}),
      ...(features ? { features } : {}),
    });
  }
  return out;
}

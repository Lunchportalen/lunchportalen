import "server-only";

import {
  blendFeatureLearningForPatternContext,
  featureScore,
  pickFeatureValue,
  strategyFeatureBias,
  tripleComboSelectionScore,
} from "@/lib/public/demoCtaAb/featureScoring";
import {
  allDemoCtaTripleComboKeys,
  demoCtaFramingToneKey,
  demoCtaToneVerbKey,
  DEMO_CTA_FEATURE_LENGTHS,
  parseTripleComboKey,
  type DemoCtaFeatures,
  type DemoCtaStrategyMode,
  type FeatureLearningState,
} from "@/lib/public/demoCtaAb/types";

/**
 * Genererer nye CTA-tekster ut fra beste performere (deterministisk, uten eksterne API-kall).
 * Varianter holdes korte, norske, rolig tone — i tråd med kommersiell copy-law.
 */
export function proposeDemoCtaLabelFromWinners(params: {
  topLabel: string;
  runnerUpLabel: string;
  newVariantId: string;
}): string {
  const { topLabel, runnerUpLabel, newVariantId } = params;
  const a = topLabel.trim();
  const b = runnerUpLabel.trim();
  const seed = `${a}|${b}|${newVariantId}`;
  const h = simpleHash(seed);

  const templates: string[] = [
    `Kom i gang — ${shortHook(a, h)}`,
    `${actionPhrase(h)} med egne tall`,
    `Se ${possessiveBedrift(h)} tall i praksis`,
    `${ctaVerb(h)} og sett opp på minutter`,
    `Prøv ${productNoun(h)} med dine tall`,
    `${warmOpen(h)} — ingen forpliktelse`,
  ];

  const idx = h % templates.length;
  let chosen = sanitizeCtaLabel(templates[idx]!);

  if (chosen.length < 8 || isTooCloseTo(chosen, [a, b])) {
    chosen = sanitizeCtaLabel(`${actionPhrase(h + 1)} — ${shortHook(b, h + 3)}`);
  }
  if (chosen.length < 8 || isTooCloseTo(chosen, [a, b])) {
    chosen = sanitizeCtaLabel(`Start med bedriften — ${shortHook(a, h + 7)}`);
  }

  return chosen.slice(0, 120);
}

/**
 * Velger feature-kombinasjon fra lært state + strategi, bygger rolig norsk CTA.
 */
export function generateVariantFromLearning(params: {
  learning: FeatureLearningState;
  /** Per `d:device|i:intent` — blandes inn i valg av triple/marginaler når satt. */
  patternLearningByContext?: Record<string, FeatureLearningState> | null;
  patternContextKey?: string | null;
  strategyMode: DemoCtaStrategyMode;
  explorationRate: number;
  newVariantId: string;
  rng?: () => number;
}): { label: string; features: DemoCtaFeatures } {
  const rng = params.rng ?? Math.random;
  const bias = strategyFeatureBias(params.strategyMode);
  const slice =
    params.patternContextKey && params.patternLearningByContext
      ? params.patternLearningByContext[params.patternContextKey] ?? null
      : null;
  const learning = blendFeatureLearningForPatternContext(params.learning, slice);
  const h = simpleHash(`${params.newVariantId}|${params.strategyMode}`);

  const tripleKeyPicked = pickFeatureValue({
    candidates: allDemoCtaTripleComboKeys(),
    explorationRate: params.explorationRate,
    rng,
    scores: (tk) => {
      const parsed = parseTripleComboKey(tk);
      if (!parsed) return 0.5;
      const { tone: t, verb: v, framing: f } = parsed;
      const marginalBlend =
        (featureScore(learning.tone[t]) +
          featureScore(learning.verb[v]) +
          featureScore(learning.framing[f]) +
          featureScore(learning.tone_verb[demoCtaToneVerbKey(t, v)]) +
          featureScore(learning.framing_tone[demoCtaFramingToneKey(f, t)])) /
        5;
      const biasBoost = (bias.tone[t] ?? 0) * 0.36 + (bias.framing[f] ?? 0) * 0.36;
      const base = tripleComboSelectionScore({
        tripleStat: learning.tone_verb_framing[tk],
        marginalBlend,
        biasBoost,
      });
      const spread = ((simpleHash(`${tk}|${params.newVariantId}`) % 2001) / 1000 - 1) * 0.028;
      return base + spread;
    },
  });
  const triple = parseTripleComboKey(tripleKeyPicked);
  const tone = triple?.tone ?? "benefit";
  const verb = triple?.verb ?? "start";
  const framing = triple?.framing ?? "result";

  const length = pickFeatureValue({
    candidates: [...DEMO_CTA_FEATURE_LENGTHS],
    explorationRate: params.explorationRate,
    rng,
    scores: (l) => featureScore(learning.length[l]),
  });

  const features: DemoCtaFeatures = { tone, verb, framing, length };
  const label = buildLabelFromFeatures(features, h, length);
  return { label: sanitizeCtaLabel(label).slice(0, 120), features };
}

function buildLabelFromFeatures(f: DemoCtaFeatures, salt: number, length: DemoCtaFeatures["length"]): string {
  const v = verbStem(f.verb, salt);
  const t = toneWrapper(f.tone);
  const m = framingMiddle(f.framing, salt);
  const long = length === "medium";

  if (f.framing === "question") {
    return `${v.lead} med ${m.object}${t.qSuffix}`;
  }
  if (f.framing === "process") {
    return long ? `${v.lead} — ${m.processPhrase} (${t.softClose})` : `${v.lead} — ${m.processPhrase}`;
  }
  return long ? `${v.lead} — ${m.resultPhrase} (${t.softClose})` : `${v.lead} — ${m.resultPhrase}`;
}

function verbStem(verb: DemoCtaFeatures["verb"], salt: number) {
  const table: Record<DemoCtaFeatures["verb"], { lead: string }> = {
    see: { lead: "Se" },
    start: { lead: "Kom i gang" },
    increase: { lead: "Bygg videre" },
    activate: { lead: "Sett i gang" },
  };
  const opts = [table[verb], verb === "start" ? { lead: "Start rolig" } : table[verb]];
  return opts[salt % opts.length]!;
}

function toneWrapper(tone: DemoCtaFeatures["tone"]) {
  const packs: Record<DemoCtaFeatures["tone"], { qSuffix: string; softClose: string }> = {
    curiosity: { qSuffix: " for din bedrift?", softClose: "uten forpliktelse" },
    direct: { qSuffix: " nå?", softClose: "ingen forpliktelse" },
    benefit: { qSuffix: " — med egne tall?", softClose: "du beholder kontrollen" },
    urgency: { qSuffix: " i dag?", softClose: "rask oppstart" },
  };
  return packs[tone];
}

function framingMiddle(framing: DemoCtaFeatures["framing"], salt: number) {
  const result = [
    "konkret oppsett med egne tall",
    "ekte struktur før du bestemmer deg",
    "tallene dine i en trygg demo",
  ];
  const process = [
    "rolig oppstart på minutter",
    "samme flyt som i portalen",
    "enkelt oppsett uten støy",
  ];
  const objects = ["lunsjoppsettet", "flyten", "oppsettet"];
  if (framing === "result") {
    return {
      resultPhrase: result[salt % result.length]!,
      processPhrase: process[salt % process.length]!,
      object: objects[salt % objects.length]!,
    };
  }
  if (framing === "process") {
    return {
      resultPhrase: result[(salt + 1) % result.length]!,
      processPhrase: process[(salt + 2) % process.length]!,
      object: objects[(salt + 1) % objects.length]!,
    };
  }
  return {
    resultPhrase: result[(salt + 2) % result.length]!,
    processPhrase: process[(salt + 1) % process.length]!,
    object: objects[(salt + 2) % objects.length]!,
  };
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function shortHook(base: string, salt: number): string {
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length <= 3) return base.slice(0, 56);
  const start = salt % Math.max(1, words.length - 2);
  return words.slice(start, start + 4).join(" ").slice(0, 56);
}

function actionPhrase(salt: number): string {
  const opts = ["Registrer", "Kom i gang", "Gå videre", "Sett i gang", "Prøv nå"];
  return opts[salt % opts.length]!;
}

function ctaVerb(salt: number): string {
  const opts = ["Opprett", "Kom i gang", "Registrer"];
  return opts[salt % opts.length]!;
}

function possessiveBedrift(salt: number): string {
  return salt % 2 === 0 ? "bedriftens" : "deres";
}

function productNoun(salt: number): string {
  const opts = ["lunsjoppsettet", "oppsettet", "flyten"];
  return opts[salt % opts.length]!;
}

function warmOpen(salt: number): string {
  const opts = ["En enkel vei inn", "Rolig oppstart", "Samme flyt som i portalen"];
  return opts[salt % opts.length]!;
}

function sanitizeCtaLabel(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\s—–-]+|[\s—–-]+$/g, "")
    .trim();
}

function isTooCloseTo(label: string, refs: string[]): boolean {
  const L = label.toLowerCase();
  return refs.some((r) => {
    const R = r.toLowerCase();
    if (L === R) return true;
    if (L.length >= 12 && R.length >= 12 && (L.includes(R.slice(0, 12)) || R.includes(L.slice(0, 12)))) return true;
    return false;
  });
}

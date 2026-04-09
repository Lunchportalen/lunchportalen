/**
 * Monopol-strategisk kontroll — forklarbar, stabil sammenslåing av kategori, posisjon, distribusjon og vollgrav.
 * Varsler ved **fall** i posisjon, distribusjon eller vollgrav sammenlignet med forrige kjøring (tilstand i minne).
 */
import "server-only";

import { EXAMPLE_CATEGORY, scoreCategoryClarity, type Category } from "@/lib/monopoly/category";
import { coverageScore, type ChannelPresence } from "@/lib/monopoly/distribution";
import { moatStrength, type MoatInputs } from "@/lib/monopoly/moat";
import { scorePositionStrength, type Position } from "@/lib/monopoly/position";

/** Standard posisjon — kan overstykes via {@link setPosition}. */
const DEFAULT_POSITION: Position = {
  coreMessage:
    "Lunchportalen gir bedrifter forutsigbar lunsj og budsjettkontroll uten å drifte egen kantine — én sannhetskilde for bestillinger og leveranser.",
  proofPoints: [
    "Samlet bestilling og takster per lokasjon",
    "Integrert leverandør- og rutebilde",
    "Sporbarhet for HR og ledelse uten manuelle eksport",
    "Rollebasert tilgang med tenant-isolasjon",
  ],
  differentiation: [
    "Kun B2B-bedriftslunsj — ikke generisk hjemlevering",
    "Operasjonell sannhet for kjøkken og sjåfør i sanntid",
    "Kontrakts- og prislogikk tilpasset bedriftsmarkedet",
  ],
};

type MetricsSnapshot = {
  category: number;
  position: number;
  distribution: number;
  moat: number;
};

let categoryState: Category = { ...EXAMPLE_CATEGORY, keywords: [...EXAMPLE_CATEGORY.keywords] };
let positionState: Position = {
  ...DEFAULT_POSITION,
  proofPoints: [...DEFAULT_POSITION.proofPoints],
  differentiation: [...DEFAULT_POSITION.differentiation],
};
let distributionState: ChannelPresence = {};
let moatState: MoatInputs = {
  dataAdvantage: 0.45,
  workflowLockIn: 0.45,
  switchingCost: 0.45,
};

let previousMetrics: MetricsSnapshot | null = null;

const OWNERSHIP_WEIGHTS = {
  category: 0.25,
  position: 0.25,
  distribution: 0.25,
  moat: 0.25,
} as const;

export type OwnershipBreakdown = {
  /** 0–100 egen eierskap til kategorien (klarhet). */
  categoryScore: number;
  /** 0–100 posisjonsstyrke. */
  positionScore: number;
  /** 0–100 distribusjonsdekning. */
  distributionScore: number;
  /** 0–100 vollgrav. */
  moatScore: number;
  /** Vektet snitt — samme som `strength` i {@link MonopolyRunResult}. */
  ownershipScore: number;
  explain: string[];
};

export type MonopolyAlert = {
  kind: "ownership_pressure";
  /** Menneskelig lesbar årsak. */
  reasons: string[];
  /** Negative endringer fra forrige kjøring (kun dimensjoner som falt). */
  deltas: {
    position?: number;
    distribution?: number;
    moat?: number;
  };
};

export type MonopolyRunResult = {
  /** Samlet eierskaps-/kategori-styrke 0–100. */
  strength: number;
  ownership: OwnershipBreakdown;
  alert: MonopolyAlert | null;
};

export function getCategory(): Category {
  return {
    ...categoryState,
    keywords: [...categoryState.keywords],
  };
}

export function getPosition(): Position {
  return {
    ...positionState,
    proofPoints: [...positionState.proofPoints],
    differentiation: [...positionState.differentiation],
  };
}

export function getDistribution(): ChannelPresence {
  return { ...distributionState };
}

export function getMoat(): MoatInputs {
  return { ...moatState };
}

export function setCategory(c: Category): void {
  categoryState = {
    ...c,
    keywords: Array.isArray(c.keywords) ? [...c.keywords] : [],
  };
}

export function setPosition(p: Position): void {
  positionState = {
    ...p,
    proofPoints: Array.isArray(p.proofPoints) ? [...p.proofPoints] : [],
    differentiation: Array.isArray(p.differentiation) ? [...p.differentiation] : [],
  };
}

export function setDistribution(presence: ChannelPresence): void {
  distributionState = { ...presence };
}

export function setMoat(m: MoatInputs): void {
  moatState = { ...m };
}

/** Nullstill sammenligningsgrunnlag (f.eks. tester). */
export function resetMonopolyBaseline(): void {
  previousMetrics = null;
}

/**
 * Beregner samlet eierskap 0–100 fra fire dimensjoner — lik vekt, deterministisk.
 */
export function calculateOwnership(
  category: Category,
  position: Position,
  distribution: ChannelPresence,
  moat: MoatInputs,
): OwnershipBreakdown {
  const cat = scoreCategoryClarity(category).score;
  const pos = scorePositionStrength(position).score;
  const dist = coverageScore(distribution).score;
  const m = moatStrength(moat).score;

  const ownershipScore = Math.round(
    cat * OWNERSHIP_WEIGHTS.category +
      pos * OWNERSHIP_WEIGHTS.position +
      dist * OWNERSHIP_WEIGHTS.distribution +
      m * OWNERSHIP_WEIGHTS.moat,
  );

  const explain = [
    `Kategori (klarhet): ${cat}/100 — vekt ${(OWNERSHIP_WEIGHTS.category * 100).toFixed(0)} %.`,
    `Posisjon (styrke): ${pos}/100 — vekt ${(OWNERSHIP_WEIGHTS.position * 100).toFixed(0)} %.`,
    `Distribusjon (dekning): ${dist}/100 — vekt ${(OWNERSHIP_WEIGHTS.distribution * 100).toFixed(0)} %.`,
    `Vollgrav: ${m}/100 — vekt ${(OWNERSHIP_WEIGHTS.moat * 100).toFixed(0)} %.`,
    `Eierskap score (vektet snitt): ${ownershipScore}/100.`,
  ];

  return {
    categoryScore: cat,
    positionScore: pos,
    distributionScore: dist,
    moatScore: m,
    ownershipScore,
    explain,
  };
}

function buildAlert(prev: MetricsSnapshot, next: MetricsSnapshot): MonopolyAlert | null {
  const reasons: string[] = [];
  const deltas: MonopolyAlert["deltas"] = {};

  if (next.position < prev.position) {
    const d = next.position - prev.position;
    deltas.position = d;
    reasons.push(`Posisjon svekket (${d} poeng vs. forrige kjøring).`);
  }
  if (next.distribution < prev.distribution) {
    const d = next.distribution - prev.distribution;
    deltas.distribution = d;
    reasons.push(`Distribusjon falt (${d} poeng vs. forrige kjøring).`);
  }
  if (next.moat < prev.moat) {
    const d = next.moat - prev.moat;
    deltas.moat = d;
    reasons.push(`Vollgrav redusert (${d} poeng vs. forrige kjøring).`);
  }

  if (reasons.length === 0) return null;
  return { kind: "ownership_pressure", reasons, deltas };
}

/**
 * Én runde: les tilstand → beregn eierskap → sammenlign med forrige metrikk → ev. varsel → oppdater baseline.
 */
export function runMonopoly(): MonopolyRunResult {
  const category = getCategory();
  const position = getPosition();
  const distribution = getDistribution();
  const moat = getMoat();

  const ownership = calculateOwnership(category, position, distribution, moat);
  const strength = ownership.ownershipScore;

  const current: MetricsSnapshot = {
    category: ownership.categoryScore,
    position: ownership.positionScore,
    distribution: ownership.distributionScore,
    moat: ownership.moatScore,
  };

  const alert = previousMetrics != null ? buildAlert(previousMetrics, current) : null;
  previousMetrics = { ...current };

  return {
    strength,
    ownership,
    alert,
  };
}

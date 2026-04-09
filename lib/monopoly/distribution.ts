/**
 * Distribusjon — kanaldekning som kan måles (0–1 per kanal) og skaleres (samme modell for alle kanaler).
 * Ingen ML; samme input gir samme score og gap-liste.
 */

export const DISTRIBUTION_CHANNELS = ["seo", "social", "paid", "outbound"] as const;
export type DistributionChannel = (typeof DISTRIBUTION_CHANNELS)[number];

export type ChannelMapEntry = {
  id: DistributionChannel;
  /** Kort navn for UI / rapporter. */
  labelNb: string;
};

/** Kanalkart — referanse for maksimal tilstedeværelse. */
export const CHANNEL_MAP: ChannelMapEntry[] = [
  { id: "seo", labelNb: "SEO (organisk)" },
  { id: "social", labelNb: "Sosiale medier" },
  { id: "paid", labelNb: "Betalt (annonser)" },
  { id: "outbound", labelNb: "Utgående (e-post/SDR)" },
];

/** Målt tilstedeværelse per kanal: 0–1 (eller 0–100 som normaliseres til 0–1). */
export type ChannelPresence = Partial<Record<DistributionChannel, number>>;

export type DistributionGapKind = "missing" | "weak";

export type DistributionGap = {
  channel: DistributionChannel;
  kind: DistributionGapKind;
  /** 0–1 etter normalisering; `null` når kanal ikke er rapportert. */
  level: number | null;
  detail: string;
};

export type CoverageResult = {
  /** 0–100 — vektet lik fordeling på fire kanaler. */
  score: number;
  explain: string[];
  gaps: DistributionGap[];
};

/** Under denne terskelen (0–1) regnes tilstedeværelse som svak. */
export const WEAK_PRESENCE_THRESHOLD = 0.35;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Normaliserer måling: støtter 0–1 eller 0–100 (f.eks. 40 → 0,4).
 */
export function normalizePresenceValue(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 1 && n <= 100) return clamp01(n / 100);
  if (n > 100) return 1;
  return clamp01(n);
}

function channelLabel(id: DistributionChannel): string {
  return CHANNEL_MAP.find((c) => c.id === id)?.labelNb ?? id;
}

/**
 * Dekningsscore (0–100) + identifiserte gap: manglende kanaler og svak tilstedeværelse.
 *
 * - **Manglende**: kanal ikke rapportert (`undefined` / ikke satt i `presence`).
 * - **Svak**: rapportert verdi under {@link WEAK_PRESENCE_THRESHOLD} (0–1 etter normalisering).
 *
 * Tomt argument → alle kanaler mangler (score 0).
 */
export function coverageScore(presence: ChannelPresence = {}): CoverageResult {
  const explain: string[] = [];
  const gaps: DistributionGap[] = [];

  let sum = 0;
  const weight = 100 / DISTRIBUTION_CHANNELS.length;

  for (const id of DISTRIBUTION_CHANNELS) {
    const raw = presence[id];
    const level = normalizePresenceValue(raw);

    if (level === null) {
      gaps.push({
        channel: id,
        kind: "missing",
        level: null,
        detail: `${channelLabel(id)}: ikke rapportert — måling eller plan mangler.`,
      });
      explain.push(`${channelLabel(id)}: ikke rapportert → 0 poeng (vekt ${weight.toFixed(0)}).`);
      continue;
    }

    sum += level * weight;

    if (level < WEAK_PRESENCE_THRESHOLD) {
      gaps.push({
        channel: id,
        kind: "weak",
        level,
        detail: `${channelLabel(id)}: svak tilstedeværelse (${(level * 100).toFixed(0)} % av mål — terskel ${(WEAK_PRESENCE_THRESHOLD * 100).toFixed(0)} %).`,
      });
      explain.push(
        `${channelLabel(id)}: ${(level * 100).toFixed(0)} % → +${(level * weight).toFixed(1)} poeng; under terskel (svak).`,
      );
    } else {
      explain.push(`${channelLabel(id)}: ${(level * 100).toFixed(0)} % → +${(level * weight).toFixed(1)} poeng.`);
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(sum)));
  explain.push(`Dekningsscore: ${score}/100 (lik vekt på ${DISTRIBUTION_CHANNELS.length} kanaler).`);

  return { score, explain, gaps };
}

/**
 * Alias for lesbarhet — samme som `coverageScore().gaps`.
 */
export function identifyDistributionGaps(presence: ChannelPresence = {}): DistributionGap[] {
  return coverageScore(presence).gaps;
}

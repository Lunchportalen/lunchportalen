/**
 * Konkurranse-innsikt — **kun tillatte kilder**: manuell kuratering, offentlige signaler du allerede har lov å bruke
 * (f.eks. egne notater fra åpne nettsider), og interne observasjoner. **Ingen scraping** og ingen automatisk innhenting.
 */
import "server-only";

export type Competitor = {
  id: string;
  name: string;
  market: string;
  position: "low" | "mid" | "high";
  strengths: string[];
  weaknesses: string[];
  estimatedTraffic?: number;
  /**
   * Sporbarhet: hva bygger profilen på (kun metadata — verifiser juridisk før bruk i produkt).
   */
  evidence?: CompetitorEvidence[];
};

export type CompetitorEvidence = {
  kind: "manual" | "public_signal" | "internal_observation";
  /** Kort merknad, f.eks. «Q4-strateginotat» eller «offisiell prisliste». */
  label: string;
  recordedAtIso?: string;
};

export type CompetitorScoreResult = {
  /** 0–100, deterministisk fra felt i {@link Competitor}. */
  score: number;
  explain: string[];
};

const registry = new Map<string, Competitor>();

/**
 * Enkel, forklarbar score — ingen ML. Bruker posisjon, antall styrker/svakheter og valgfri trafikk-estimat.
 */
export function scoreCompetitor(c: Competitor): CompetitorScoreResult {
  const base =
    c.position === "low" ? 30 : c.position === "mid" ? 50 : 70;

  const s = Array.isArray(c.strengths) ? c.strengths.filter((x) => String(x).trim()).length : 0;
  const w = Array.isArray(c.weaknesses) ? c.weaknesses.filter((x) => String(x).trim()).length : 0;

  const strengthPts = Math.min(20, s * 4);
  const weaknessPen = Math.min(20, w * 3);

  let trafficPts = 0;
  if (c.estimatedTraffic != null && Number.isFinite(c.estimatedTraffic) && c.estimatedTraffic >= 0) {
    trafficPts = Math.min(10, Math.log1p(c.estimatedTraffic) * 1.2);
  }

  const raw = base + strengthPts - weaknessPen + trafficPts;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const explain: string[] = [
    `Grunnlag: posisjon «${c.position}» → basis ${base}.`,
    `Styrker: ${s} punkter → +${strengthPts} (cap 20).`,
    `Svakheter: ${w} punkter → −${weaknessPen} (cap 20).`,
    c.estimatedTraffic != null && Number.isFinite(c.estimatedTraffic)
      ? `Estimert trafikk (intern kuratering): +${trafficPts.toFixed(1)} (cap 10, log1p-skalert).`
      : "Ingen estimert trafikk — trafikkledd 0.",
    "Ingen nettverkshenting; kun strukturerte felt du har lagt inn.",
  ];

  return { score, explain };
}

/** Manuell / sjekket inn profil (prosess-lokalt; persistens = eksplisitt senere). */
export function upsertCompetitor(c: Competitor): void {
  const id = String(c.id ?? "").trim();
  if (!id) return;
  registry.set(id, {
    ...c,
    id,
    strengths: Array.isArray(c.strengths) ? [...c.strengths] : [],
    weaknesses: Array.isArray(c.weaknesses) ? [...c.weaknesses] : [],
    evidence: Array.isArray(c.evidence) ? [...c.evidence] : undefined,
  });
}

export function getCompetitor(id: string): Competitor | undefined {
  const k = String(id ?? "").trim();
  if (!k) return undefined;
  const v = registry.get(k);
  return v ? { ...v, strengths: [...v.strengths], weaknesses: [...v.weaknesses], evidence: v.evidence ? [...v.evidence] : undefined } : undefined;
}

export function listCompetitors(): Competitor[] {
  return [...registry.values()].map((c) => ({
    ...c,
    strengths: [...c.strengths],
    weaknesses: [...c.weaknesses],
    evidence: c.evidence ? [...c.evidence] : undefined,
  }));
}

export function removeCompetitor(id: string): boolean {
  const k = String(id ?? "").trim();
  if (!k) return false;
  return registry.delete(k);
}

/** Nullstill register (f.eks. tester). */
export function clearCompetitors(): void {
  registry.clear();
}

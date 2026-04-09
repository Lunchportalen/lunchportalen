/**
 * Vollgrav (moat) — **må** bygge på reelle, dokumenterbare forhold (input per dimensjon).
 * Score er deterministisk; «varig» krever styrke på tvers av data, arbeidsflyt og byttekost.
 */

export type MoatInputs = {
  /**
   * 0–1: egen data, historikk eller nettverkseffekt som er vanskelig å kopiere.
   * Må underbygges av faktiske forhold — tall er egen vurdering/kilde.
   */
  dataAdvantage?: number;
  /**
   * 0–1: hvor dypt kundens operasjon er integrert i arbeidsflyt i produktet.
   */
  workflowLockIn?: number;
  /**
   * 0–1: økonomisk/operasjonell/risiko-messig kost ved å bytte leverandør.
   */
  switchingCost?: number;
};

export type MoatDimensionId = "dataAdvantage" | "workflowLockIn" | "switchingCost";

export type MoatDimensionAnalysis = {
  id: MoatDimensionId;
  labelNb: string;
  /** 0–1 etter normalisering, eller `null` hvis ikke rapportert. */
  level: number | null;
  /** Bidrag til totalscore (0–100 skalert per dimensjon). */
  contributionPoints: number;
  summary: string;
};

export type MoatAnalysis = {
  /** 0–100 — lik vekt på tre dimensjoner. */
  score: number;
  explain: string[];
  dimensions: Record<MoatDimensionId, MoatDimensionAnalysis>;
  /** Samlet vurdering av hvor **varig** forsvaret er gitt rapporterte nivåer. */
  durability: "low" | "medium" | "high";
  /** Hvor forsvaret er tynt eller urapportert — må adresseres for reell defensibility. */
  risks: string[];
};

const DIM_LABELS: Record<MoatDimensionId, string> = {
  dataAdvantage: "Datafordel",
  workflowLockIn: "Arbeidsflyt-låsing",
  switchingCost: "Byttekostnad",
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Normaliserer 0–1 eller 0–100.
 */
export function normalizeMoatLevel(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 1 && n <= 100) return clamp01(n / 100);
  if (n > 100) return 1;
  return clamp01(n);
}

function durabilityFrom(score: number, levels: (number | null)[]): "low" | "medium" | "high" {
  const all = levels.every((x) => x != null) ? levels : null;
  if (!all) return "low";
  const [a, b, c] = all as number[];
  const min = Math.min(a, b, c);
  if (score >= 72 && min >= 0.55) return "high";
  if (score >= 48 && min >= 0.35) return "medium";
  return "low";
}

/**
 * Beregner vollgrav-styrke og strukturert analyse.
 * Uten input eller med manglende dimensjoner: **fail-closed** (lavt nivå + risiko merket).
 */
export function moatStrength(input: MoatInputs = {}): MoatAnalysis {
  const explain: string[] = [];
  const risks: string[] = [];

  const ids = Object.keys(DIM_LABELS) as MoatDimensionId[];
  const dimensions = {} as Record<MoatDimensionId, MoatDimensionAnalysis>;
  let sumPoints = 0;
  const weight = 100 / ids.length;

  for (const id of ids) {
    const level = normalizeMoatLevel(input[id]);
    const labelNb = DIM_LABELS[id];

    if (level === null) {
      risks.push(`${labelNb} er ikke rapportert — reell fordel kan ikke verifiseres fra tall.`);
      dimensions[id] = {
        id,
        labelNb,
        level: null,
        contributionPoints: 0,
        summary: "Ikke dokumentert i denne kjøringen — behandles som 0 inntil målt.",
      };
      explain.push(`${labelNb}: ikke rapportert → 0 / ${weight.toFixed(1)} poeng.`);
      continue;
    }

    const pts = level * weight;
    sumPoints += pts;

    let summary: string;
    if (level >= 0.7) {
      summary = "Sterkt signal — typisk konkret, målbar fordel som er vanskelig å kopiere raskt.";
    } else if (level >= 0.45) {
      summary = "Moderat — forbedringsrom; forsterk med kontrakter, integrasjoner eller data.";
    } else {
      summary = "Svakt — lav defensibility inntil forbedret med reelle strukturelle grep.";
      risks.push(`${labelNb} er lav (${(level * 100).toFixed(0)} %) — konkurrent kan utfordre med pris eller kopifunksjon.`);
    }

    dimensions[id] = {
      id,
      labelNb,
      level,
      contributionPoints: Math.round(pts * 10) / 10,
      summary,
    };
    explain.push(`${labelNb}: ${(level * 100).toFixed(0)} % → +${pts.toFixed(1)} poeng.`);
  }

  const score = Math.max(0, Math.min(100, Math.round(sumPoints)));
  const levelList = ids.map((i) => dimensions[i].level);
  const durability = durabilityFrom(score, levelList);

  explain.push(`Total moat-styrke: ${score}/100.`);
  explain.push(
    durability === "high"
      ? "Varighet: høy — tre dimensjoner støtter hverandre (krever fortsatt kontinuerlig investering)."
      : durability === "medium"
        ? "Varighet: middels — forsterk svake dimensjoner for varig konkurransefortrinn."
        : "Varighet: lav — bygg målbare grep i data, flyt og byttekost før marked presser margin.",
  );

  if (risks.length === 0) {
    risks.push("Ingen kritiske hull i rapporteringen — oppdater tall ved endring i marked eller produkt.");
  }

  return {
    score,
    explain,
    dimensions,
    durability,
    risks,
  };
}

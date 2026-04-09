import "server-only";

import type { AiLayoutRunContext } from "@/lib/ai/layout";
import { generatePage } from "@/lib/ai/pageBuilder";
import { opsLog } from "@/lib/ops/log";

export type DiverseVariant = {
  variantId: "B" | "C";
  angle: string;
  blocks: unknown[];
};

export type DiverseGenerationResult = {
  /** Deployed as experiment variants B and C (A = baseline elsewhere). */
  variants: DiverseVariant[];
  /**
   * Third AI pass (different angle) — not a traffic variant; logged for learning / audit.
   * Does not create variant D in DB.
   */
  alternateAngle: { angle: string; blocks: unknown[] } | null;
};

type GenSpec =
  | { slot: "B" | "C"; angle: string; instruction: string }
  | { slot: "alternate"; angle: string; instruction: string };

const SPECS: GenSpec[] = [
  {
    slot: "B",
    angle: "trygg_forbedring",
    instruction:
      "Vinkling: trygg, målbar forbedring — tydelig verdi, rolig tone, én primær CTA. Minimal risiko; behold merke og tillit.",
  },
  {
    slot: "C",
    angle: "aggressiv_cta",
    instruction:
      "Vinkling: aggressiv men profesjonell CTA — sterk oppfordring, tydelig neste steg, høy konverteringsintensjon. Ikke kopier B ordrett.",
  },
  {
    slot: "alternate",
    angle: "annen_fortelling",
    instruction:
      "Vinkling: helt annen vinkel (f.eks. tid/spart kost, arbeidsplasskultur, forutsigbarhet) — fortsatt norsk B2B-lunsj, men distinkt fra B og C.",
  },
];

/**
 * Three AI proposals for growth learning: B (safe), C (aggressive CTA), plus a third alternate angle (logged only).
 */
export async function generateMooVariantsDiverse(pageBlocks: unknown[], ctx: AiLayoutRunContext): Promise<DiverseGenerationResult> {
  const blocks = Array.isArray(pageBlocks) ? pageBlocks : [];
  const baseJson = JSON.stringify(blocks).slice(0, 12_000);
  const variants: DiverseVariant[] = [];
  let alternateAngle: { angle: string; blocks: unknown[] } | null = null;

  for (const spec of SPECS) {
    const prompt = `
Du er innholdsstrateg for en norsk B2B-lunsj/markedsplass-side.

${spec.instruction}

Krav:
- Behold struktur som fungerer for mobil (ingen horisontal scroll i konsept).
- Returner kun gyldige CMS-blokker (JSON), ikke rå HTML i tekstfelt.

Eksisterende blokker (utgangspunkt):
${baseJson}
`.trim();

    const draft = await generatePage(prompt, ctx);
    const next = Array.isArray(draft.blocks) && draft.blocks.length > 0 ? draft.blocks : blocks;

    if (spec.slot === "alternate") {
      alternateAngle = { angle: spec.angle, blocks: next as unknown[] };
      opsLog("moo.generate.alternate_angle", {
        angle: spec.angle,
        blockCount: Array.isArray(next) ? next.length : 0,
      });
      continue;
    }

    variants.push({ variantId: spec.slot, angle: spec.angle, blocks: next as unknown[] });
  }

  return { variants, alternateAngle };
}

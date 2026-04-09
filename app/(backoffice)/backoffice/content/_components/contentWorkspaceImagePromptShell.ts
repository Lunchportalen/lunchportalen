/**
 * Bilde-prompt / preset-hjelpere for workspace AI-bilde (ren flytting fra ContentWorkspace).
 * Samme strenger og regler; ingen endring i preview-pipeline.
 */

import * as EditorK from "./contentWorkspaceEditorConstants";
import { getBlockEntryFlatForRender } from "@/lib/cms/blocks/blockEntryContract";
import type { Block } from "./editorBlockTypes";

function heroLikeText(block: Block): string {
  if (block.type === "hero" || block.type === "hero_full" || block.type === "hero_bleed") {
    const f = getBlockEntryFlatForRender(block);
    return `${String(f.title ?? "")} ${String(f.subtitle ?? "")}`;
  }
  return "";
}

export function extractWorkspaceBlockText(block: Block): string {
  if (block.type === "richText") return block.body ?? "";
  return "";
}

export function buildWorkspaceImagePrompt(block: Block, imagePreset: string, presetOverride?: string): string {
  const presetText =
    EditorK.IMAGE_PRESETS[(presetOverride ?? imagePreset) as keyof typeof EditorK.IMAGE_PRESETS] ?? EditorK.IMAGE_PRESETS.office;
  const text = (
    (block as { content?: unknown }).content ||
    (block as { text?: unknown }).text ||
    heroLikeText(block) ||
    (block.type === "image" ? `${block.caption ?? ""} ${block.alt ?? ""}` : "") ||
    (block.type === "richText" ? `${block.heading ?? ""} ${block.body ?? ""}` : "")
  )
    .toString()
    .toLowerCase();
  let blockSpecificContext = `
Moderne kontorlunsj,
delikat mat, fokus på kvalitet
`;
  if (block.type === "hero" || block.type === "hero_full" || block.type === "hero_bleed") {
    blockSpecificContext = `
Stor sosial lunsjscene i kontor,
mange ansatte rundt bord,
energi, fellesskap,
bred komposisjon,
mennesker i bakgrunn + mat i forgrunn,
dybde i bildet
`;
  }
  if (block.type === "image" && (presetOverride ?? imagePreset) === "closeup") {
    blockSpecificContext = `
Nærbilde av premium mat og råvarer,
fokus på detaljer,
grunn dybdeskarphet,
rolig bakgrunn
`;
  } else if (text.includes("buffet")) {
    blockSpecificContext = `
Delikat buffet med variert utvalg,
salater, brød, juice,
pent oppdekket
`;
  } else if (text.includes("møte")) {
    blockSpecificContext = `
Lunsj i møterom,
ansatte rundt bord,
profesjonell stemning
`;
  } else {
    blockSpecificContext = `
${presetText},
${blockSpecificContext}
`;
  }
  return `
${presetText}
${blockSpecificContext}
${EditorK.LUNCHPORTALEN_STYLE}
${EditorK.LUNCHPORTALEN_NEGATIVE}
stil-seed: ${EditorK.LUNCHPORTALEN_STYLE_SEED}
`;
}

export function resolveWorkspaceImagePreset(block: Block): string {
  const text = (
    (block as { content?: unknown }).content ||
    (block as { text?: unknown }).text ||
    heroLikeText(block) ||
    (block.type === "image" ? `${block.caption ?? ""} ${block.alt ?? ""}` : "") ||
    (block.type === "richText" ? `${block.heading ?? ""} ${block.body ?? ""}` : "")
  )
    .toString()
    .toLowerCase();
  if (block.type === "hero" || block.type === "hero_full" || block.type === "hero_bleed") {
    return "office";
  }
  if (text.includes("buffet") || text.includes("utvalg")) {
    return "buffet";
  }
  if (text.includes("møte") || text.includes("ansatte")) {
    return "meeting";
  }
  if (text.includes("ingredienser") || text.includes("råvarer")) {
    return "closeup";
  }
  return "office";
}

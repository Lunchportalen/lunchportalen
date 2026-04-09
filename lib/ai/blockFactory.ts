/**
 * Maps layout section ids → valid CMS serialized blocks (hero | richText | cta only here).
 * No invented block types — aligns with normalizeLayoutBlocks / editor.
 */

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";
import { newBlockId } from "@/lib/cms/model/blockId";
import type { PageIntent } from "./pageIntent";
import type { LayoutSectionId } from "./layoutRules";
import type { CmsSerializedBlock } from "./normalizeCmsBlocks";

function headlineFromPrompt(prompt: string): string {
  return prompt.trim().split("\n")[0]?.slice(0, 100).trim() || "Ny side";
}

function bulletBody(lines: string[]): string {
  return lines.map((l) => `• ${l}`).join("\n");
}

/**
 * Deterministic skeleton blocks for a layout plan + intent (Norwegian placeholders).
 */
export function createBlocksFromLayout(
  layout: readonly LayoutSectionId[],
  intent: PageIntent,
  userPrompt: string,
): CmsSerializedBlock[] {
  const title = headlineFromPrompt(userPrompt);
  const blocks: CmsSerializedBlock[] = [];

  for (const section of layout) {
    switch (section) {
      case "hero":
        blocks.push({
          id: newBlockId(),
          type: "hero",
          title,
          subtitle: `Tilpasset ${intent.audience}. Tone: ${intent.tone}.`,
          imageId: "",
          imageAlt: "",
          ctaLabel: "Les mer",
          ctaHref: "/kontakt",
        });
        break;
      case "valueProps":
        blocks.push({
          id: newBlockId(),
          type: "richText",
          heading: "Verdiforslag",
          body: bulletBody([
            "Forutsigbar drift og mindre administrasjon",
            "Trygg mat og tydelig informasjon til ansatte",
            "Skalerbart — vokser med bedriften",
          ]),
        });
        break;
      case "socialProof":
        blocks.push({
          id: newBlockId(),
          type: "richText",
          heading: "Tillit",
          body: "Kort referanse eller sitat kan stå her. Bytt ut med ekte kunder og tall når klart.",
        });
        break;
      case "productDetails":
        blocks.push({
          id: newBlockId(),
          type: "richText",
          heading: "Produkt eller tjeneste",
          body: `Beskriv tilbudet for ${intent.audience}.\n\n• Hva får kjøperen\n• Hvordan det leveres\n• Hva som skiller dere`,
        });
        break;
      case "benefits":
        blocks.push({
          id: newBlockId(),
          type: "richText",
          heading: "Fordeler",
          body: bulletBody(["Mindre friksjon for HR", "Bedre oversikt per lokasjon", "Enkel onboarding"]),
        });
        break;
      case "faq":
        blocks.push({
          id: newBlockId(),
          type: "richText",
          heading: "Ofte stilte spørsmål",
          body: "Spørsmål: …\nSvar: …\n\nSpørsmål: …\nSvar: …",
        });
        break;
      case "sections":
        blocks.push({
          id: newBlockId(),
          type: "richText",
          heading: "Flere temaer",
          body: "Del innhold i tydelige avsnitt. Én idé per avsnitt.",
        });
        break;
      case "richText":
        blocks.push({
          id: newBlockId(),
          type: "richText",
          heading: "Innhold",
          body: `Her kan du utdype budskapet for ${intent.audience}, med ${intent.tone} tone.`,
        });
        break;
      case "cta":
        blocks.push({
          id: newBlockId(),
          type: "cta",
          title: "Neste steg",
          body: "Vi hjelper dere i gang uten unødvendig kompleksitet.",
          buttonLabel: "Kontakt oss",
          buttonHref: "/kontakt",
        });
        break;
      default:
        blocks.push({
          id: newBlockId(),
          type: "richText",
          heading: "Seksjon",
          body: "Rediger denne teksten.",
        });
    }
  }

  return blocks;
}

/** Maps serialized CMS blocks to editor Block union (same contract as ContentWorkspace mapSerializedAiBlockToBlock). */
export function serializedBlocksToEditorBlocks(serialized: CmsSerializedBlock[]): Block[] {
  const out: Block[] = [];
  for (const o of serialized) {
    const b = normalizeBlock(o as unknown as Record<string, unknown>);
    if (b) out.push(b);
  }
  return out;
}

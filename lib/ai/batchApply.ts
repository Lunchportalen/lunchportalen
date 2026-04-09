/**

 * Safe, immutable batch preview for CRO fixes (append CTA only).

 * Does not persist — caller applies `nextDrafts` only to local state or exports to editor.

 */



import type { Block, CtaBlock } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";

import type { Opportunity } from "@/lib/ai/opportunities";

import type { SitePageDraft } from "@/lib/ai/siteAnalysis";

import { evaluatePage, hasEffectiveCta } from "@/lib/ai/pageScore";

import { newBlockId } from "@/lib/cms/model/blockId";



export type BatchApplyLogEntry = {

  pageId: string;

  action: string;

  scoreBefore: number;

  scoreAfter: number;

  /** Når en CTA ble lagt til i forhåndsvisning — brukes til dyplenke i editoren */

  newCtaBlockId?: string;

};



function appendSafeCta(blocks: Block[]): { next: Block[]; addedId: string } {

  const addedId = newBlockId();

  const cta: CtaBlock = {
    id: addedId,
    type: "cta",
    contentData: {
      title: "Klar for bedre lunsj?",
      body: "Ta kontakt — vi hjelper dere i gang.",
    },
    settingsData: {},
    structureData: {
      buttonLabel: "Kontakt oss",
      buttonHref: "#",
    },
  };

  return { next: [...blocks, cta], addedId };

}



/**

 * Applies only safe CRO opportunities (missing CTA) to in-memory drafts.

 * Returns cloned drafts — never mutates the input arrays/objects.

 */

export function applySafeBatchPreview(

  opportunities: Opportunity[],

  drafts: SitePageDraft[],

): { nextDrafts: SitePageDraft[]; applied: BatchApplyLogEntry[] } {

  const byId = new Map<string, SitePageDraft>(

    drafts.map((d) => [d.id, { ...d, blocks: [...d.blocks], meta: { ...d.meta } }]),

  );



  const applied: BatchApplyLogEntry[] = [];



  for (const op of opportunities) {

    if (op.type !== "cro" || op.intent !== "missing_cta") continue;

    const pageId = op.pageId;

    const d = byId.get(pageId);

    if (!d) continue;

    if (hasEffectiveCta(d.blocks)) continue;



    const scoreBefore = evaluatePage({ title: d.title, blocks: d.blocks, meta: d.meta }).score;

    const { next: nextBlocks, addedId } = appendSafeCta(d.blocks);

    const scoreAfter = evaluatePage({ title: d.title, blocks: nextBlocks, meta: d.meta }).score;



    byId.set(pageId, { ...d, blocks: nextBlocks });

    applied.push({

      pageId,

      action: "Trygg CTA-blokk lagt til (forhåndsvisning)",

      scoreBefore,

      scoreAfter,

      newCtaBlockId: addedId,

    });

  }



  return {

    nextDrafts: drafts.map((d) => byId.get(d.id) ?? d),

    applied,

  };

}


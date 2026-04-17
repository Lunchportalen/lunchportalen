"use client";

import type { Block } from "../editorBlockTypes";
import type { BlockInspectorFieldsCtx } from "../blockPropertyEditorContract";
import {
  BannerPropertyEditor,
  DividerPropertyEditor,
  FormPropertyEditor,
  ImagePropertyEditor,
  RichTextPropertyEditor,
} from "./AuxiliaryBlockPropertyEditors";
import { CardsPropertyEditor } from "./CardsPropertyEditor";
import { CtaPropertyEditor } from "./CtaPropertyEditor";
import { GridPropertyEditor } from "./GridPropertyEditor";
import { HeroBleedPropertyEditor } from "./HeroBleedPropertyEditor";
import { HeroFullPropertyEditor } from "./HeroFullPropertyEditor";
import { HeroPropertyEditor } from "./HeroPropertyEditor";
import { PricingPropertyEditor } from "./PricingPropertyEditor";
import { RelatedLinksPropertyEditor } from "./RelatedLinksPropertyEditor";
import { StepsPropertyEditor } from "./StepsPropertyEditor";
import { UnknownBlockPropertyEditor } from "./UnknownBlockPropertyEditor";

/**
 * Umbraco-style routing: one block type → one property editor component.
 * Component names must match `propertyEditorComponent` in `lib/cms/blocks/blockTypeDefinitions.ts`.
 * No monolithic field tree — `BlockInspectorFields` stays a shell + this router.
 */
export function BlockPropertyEditorRouter(props: { block: Block; ctx: BlockInspectorFieldsCtx }) {
  const { block, ctx } = props;
  switch (block.type) {
    case "hero":
      return <HeroPropertyEditor block={block} ctx={ctx} />;
    case "hero_full":
      return <HeroFullPropertyEditor block={block} ctx={ctx} />;
    case "hero_bleed":
      return <HeroBleedPropertyEditor block={block} ctx={ctx} />;
    case "richText":
      return <RichTextPropertyEditor block={block} ctx={ctx} />;
    case "image":
      return <ImagePropertyEditor block={block} ctx={ctx} />;
    case "cta":
      return <CtaPropertyEditor block={block} ctx={ctx} />;
    case "divider":
      return <DividerPropertyEditor block={block} ctx={ctx} />;
    case "banner":
      return <BannerPropertyEditor block={block} ctx={ctx} />;
    case "form":
      return <FormPropertyEditor block={block} ctx={ctx} />;
    case "relatedLinks":
      return <RelatedLinksPropertyEditor block={block} ctx={ctx} />;
    case "pricing":
      return <PricingPropertyEditor block={block} ctx={ctx} />;
    case "cards":
      return <CardsPropertyEditor block={block} ctx={ctx} />;
    case "zigzag":
      return <StepsPropertyEditor block={block} ctx={ctx} />;
    case "grid":
      return <GridPropertyEditor block={block} ctx={ctx} />;
    default:
      return <UnknownBlockPropertyEditor block={block} ctx={ctx} />;
  }
}

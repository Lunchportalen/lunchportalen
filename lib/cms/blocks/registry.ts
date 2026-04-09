/**
 * Core marketing block types: canonical definitions in `blockTypeDefinitions.ts`.
 * Public render: `lib/public/blocks/renderBlock.tsx` (registry path → EnterpriseLockedBlockView).
 */

export type { BlockCanvasFrameKind, BlockTypeDefinition, CoreRenderBlockType } from "./blockTypeDefinitions";

export {
  BLOCK_TYPE_DEFINITION_BY_ALIAS,
  CANVAS_VIEW_COMPONENT_BY_ALIAS,
  CORE_CMS_BLOCK_DEFINITIONS,
  CORE_RENDER_BLOCK_TYPES,
  getBlockTypeDefinition,
  getCanvasFrameKindForBlockType,
  KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS,
  PROPERTY_EDITOR_COMPONENT_BY_ALIAS,
  toCMSBlockDefinition,
} from "./blockTypeDefinitions";

/**
 * Thin adapter for content editor: re-exports from lib/cms and from local modules.
 * - tryParseBlockListFromBody: real implementation in bodyParse.ts.
 * - parseBodyEnvelope / serializeBodyEnvelope: real implementation in bodyEnvelope.ts.
 * - documentTypes / getDocType: real implementation in documentTypes.ts.
 * - Editor2Shell: PLACEHOLDER ONLY. useEditor2=false; no active code path. Isolated; does not affect behaviour.
 */

import type { BlockList, BlockNode } from "@/lib/cms/model/blockTypes";
export type { BlockList, BlockNode } from "@/lib/cms/model/blockTypes";
export { newBlockId } from "@/lib/cms/model/blockId";

export { getForsideBody, isForside } from "./forsideUtils";
export { tryParseBlockListFromBody } from "./bodyParse";
export { parseBodyEnvelope, serializeBodyEnvelope } from "./bodyEnvelope";
export { documentTypes, getDocType } from "./documentTypes";

// Block editor compatibility exports (used by ContentWorkspace).
export { BlockEditModal } from "./BlockEditModal";
export { MediaPickerModal } from "./MediaPickerModal";
export { validateModel } from "./blockValidation";
export { getBlockLabel } from "./blockLabels";
export { formatDateTimeNO } from "@/lib/date/format";

export type BlockType = string;

/** PLACEHOLDER: Editor 2.0 shell. Not used (useEditor2=false). Kept for type compatibility. No behavioural impact. */
export function Editor2Shell(_props: Record<string, unknown>) {
  return null;
}

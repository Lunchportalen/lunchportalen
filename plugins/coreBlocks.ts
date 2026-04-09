/**
 * Phase 18: Core blocks plugin — definitions live in `lib/cms/blocks/registry.ts`.
 */

import { CORE_CMS_BLOCK_DEFINITIONS } from "@/lib/cms/blocks/registry";
import type { CMSPlugin } from "@/lib/cms/plugins/types";

export const plugin: CMSPlugin = {
  id: "core-blocks",
  name: "Core blocks",
  enabledByDefault: true,
  blocks: CORE_CMS_BLOCK_DEFINITIONS,
};

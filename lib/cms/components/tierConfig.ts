/**

 * Enterprise component tiers (governance + documentation).

 * `core` = full registry ({@link CORE_COMPONENT_KEYS}).

 */



import { CORE_COMPONENT_KEYS } from "@/lib/cms/blocks/componentGroups";



/** Shared layout / chrome token for AI-facing components (stored where editor supports it). */

export const COMPONENT_TIERS = {

  /** Reserved: design tokens, spacing rhythm, future shell primitives. */

  foundation: [] as const,

  /** Full marketing + content + trust + data shells (locked registry types). */

  core: CORE_COMPONENT_KEYS,

  /** Reserved: composites that bundle data + layout (e.g. pricing tables, KPI bands). */

  advanced: [] as const,

  /** Reserved: charts, feeds, operational widgets (read-mostly). */

  data: [] as const,

} as const;



export type ComponentTier = keyof typeof COMPONENT_TIERS;


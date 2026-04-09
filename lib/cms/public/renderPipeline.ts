/**
 * Canonical CMS body → blocks entry for **public** and **backoffice preview**.
 * Import from here when you need the same parse contract as the live site; inner stack is
 * {@link parseBody} → {@link CmsBlockRenderer} (normalize + media + {@link renderBlock}).
 */

export { parseBody, parseBodyMeta } from "./parseBody";
export type { BlockItem } from "./parseBody";

/**
 * Canonical block registry surface for editor + public render.
 * All enterprise block type checks should resolve through this module or {@link CORE_COMPONENT_KEYS}.
 */

import { CORE_COMPONENT_KEYS } from "./componentGroups";

export { CORE_COMPONENT_KEYS, COMPONENT_GROUPS, type CoreComponentKey } from "./componentGroups";

export const ENTERPRISE_REGISTRY_BLOCK_TYPES = new Set<string>([...CORE_COMPONENT_KEYS]);

export function isEnterpriseRegistryBlockType(type: string): boolean {
  return ENTERPRISE_REGISTRY_BLOCK_TYPES.has(type);
}

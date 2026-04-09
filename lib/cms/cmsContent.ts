// STATUS: KEEP

import "server-only";

import { getSurfaceStringFromSettingsData } from "@/lib/cms/surfaceStringResolve";
import { getPublishedGlobal } from "@/lib/cms/readGlobal";
import type { CmsSurface } from "@/lib/cms/surfaces";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

export { getSurfaceStringFromSettingsData };

/**
 * Optional nested copy store inside published `global_content.settings.data`:
 *
 * ```json
 * {
 *   "surfaceCopy": {
 *     "onboarding": { "hero_title": "..." },
 *     "kitchen_view": { "empty": "..." }
 *   }
 * }
 * ```
 *
 * Incrementally migrate hardcoded UI strings here without breaking pages: callers pass an explicit fallback.
 */
export const cmsContent = {
  getFromSettingsData: getSurfaceStringFromSettingsData,

  /**
   * Server: load published settings and resolve copy. Never throws; returns fallback if missing.
   */
  async get(surface: CmsSurface, key: string, fallback: string): Promise<string> {
    const row = await getPublishedGlobal("settings");
    const data = row && isPlainObject(row.data) ? row.data : {};
    return getSurfaceStringFromSettingsData(data, surface, key, fallback);
  },
};

import "server-only";

import { parseDesignSettingsFromSettingsData, type ParsedDesignSettings } from "@/lib/cms/design/designContract";
import { getPublishedGlobal } from "@/lib/cms/readGlobal";

/**
 * Raw `settings.data` root (includes `designSettings` and other keys). Used to merge page/section layers with the same document shape as global.
 */
export async function getGlobalSettingsDataRoot(): Promise<Record<string, unknown>> {
  const row = await getPublishedGlobal("settings");
  const data = row?.data;
  if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  return {};
}

/**
 * Published global card/design tokens from `global_content.settings.data.designSettings`.
 */
export async function getDesignSettings(): Promise<ParsedDesignSettings> {
  const data = await getGlobalSettingsDataRoot();
  return parseDesignSettingsFromSettingsData(data);
}

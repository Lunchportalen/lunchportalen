import type { CmsSurface } from "@/lib/cms/surfaces";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

/**
 * Read copy from settings `data.surfaceCopy[surface][key]` (see cmsContent.ts).
 */
export function getSurfaceStringFromSettingsData(
  settingsData: Record<string, unknown>,
  surface: CmsSurface,
  key: string,
  fallback: string,
): string {
  const k = String(key ?? "").trim();
  if (!k) return fallback;
  const root = settingsData.surfaceCopy;
  if (!isPlainObject(root)) return fallback;
  const bucket = root[surface];
  if (!isPlainObject(bucket)) return fallback;
  const raw = bucket[k];
  if (typeof raw !== "string") return fallback;
  const s = raw.trim();
  return s.length > 0 ? s : fallback;
}

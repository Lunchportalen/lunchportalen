import { isCmsSurface, type CmsSurface } from "@/lib/cms/surfaces";

/** Stored under `global_content.settings.data.aiSurfaceControl` (published). */
export type SurfaceAiControlRow = {
  surface: CmsSurface;
  /** When false, optimizer should not run automated passes for this surface */
  ai_optimize_enabled: boolean;
  /** 0 = conservative, 1 = default, 2 = aggressive (advisory — enforcement in optimizer) */
  aggressiveness: 0 | 1 | 2;
  /** If true, only logged-in superadmin flows may auto-apply (still requires product rules + audit) */
  auto_apply_requires_superadmin: boolean;
};

export type SurfaceAiControlMap = Partial<Record<CmsSurface, SurfaceAiControlRow>>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

const DEFAULT_ROW: Omit<SurfaceAiControlRow, "surface"> = {
  ai_optimize_enabled: true,
  aggressiveness: 1,
  auto_apply_requires_superadmin: true,
};

/**
 * Parse superadmin-authored control map from settings JSON. Unknown keys fail closed to defaults per surface.
 */
export function parseSurfaceAiControlMap(raw: unknown): SurfaceAiControlMap {
  if (!isPlainObject(raw)) return {};
  const root = raw.aiSurfaceControl;
  if (!isPlainObject(root)) return {};
  const out: SurfaceAiControlMap = {};
  for (const [k, v] of Object.entries(root)) {
    if (!isPlainObject(v)) continue;
    const enabled = v.ai_optimize_enabled;
    const agg = v.aggressiveness;
    const autoSup = v.auto_apply_requires_superadmin;
    out[k] = {
      surface: k,
      ai_optimize_enabled: typeof enabled === "boolean" ? enabled : DEFAULT_ROW.ai_optimize_enabled,
      aggressiveness: agg === 0 || agg === 1 || agg === 2 ? agg : DEFAULT_ROW.aggressiveness,
      auto_apply_requires_superadmin:
        typeof autoSup === "boolean" ? autoSup : DEFAULT_ROW.auto_apply_requires_superadmin,
    };
  }
  return out;
}

export function getSurfaceAiControl(map: SurfaceAiControlMap, surface: CmsSurface): SurfaceAiControlRow {
  return (
    map[surface] ?? {
      surface,
      ...DEFAULT_ROW,
    }
  );
}

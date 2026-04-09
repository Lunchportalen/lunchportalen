import "server-only";

import { resolveAutonomyPolicy } from "@/lib/autonomy/policy";
import type { ResolvedAutonomyPolicy } from "@/lib/autonomy/policy";
import { getSystemSettings } from "@/lib/system/settings";

export async function getResolvedAutonomyPolicy(): Promise<ResolvedAutonomyPolicy> {
  const s = await getSystemSettings();
  return resolveAutonomyPolicy(s.toggles);
}

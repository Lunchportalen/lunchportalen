import "server-only";

import { CONTROL_PLANE_RUNTIME_MODULES } from "@/lib/cms/controlPlaneRuntimeStatusData";

export type { ControlPlaneModuleStatus, RuntimeModuleBadge } from "@/lib/cms/controlPlaneRuntimeStatusData";

export function getControlPlaneRuntimeModules() {
  return CONTROL_PLANE_RUNTIME_MODULES;
}

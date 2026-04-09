/**
 * Canonical product surfaces for CMS + AI optimization.
 * Each surface can be mapped to CMS pages, global settings keys, or experiment scope.
 */

export type CmsSurface =
  | "public_demo"
  | "public_home"
  | "onboarding"
  | "superadmin_dashboard"
  | "company_admin_dashboard"
  | "employee_app"
  | "kitchen_view"
  | "driver_view"
  | "week_view"
  | "ai_overview";

export const CMS_SURFACES: readonly CmsSurface[] = [
  "public_demo",
  "public_home",
  "onboarding",
  "superadmin_dashboard",
  "company_admin_dashboard",
  "employee_app",
  "kitchen_view",
  "driver_view",
  "week_view",
  "ai_overview",
] as const;

const SURFACE_SET = new Set<string>(CMS_SURFACES);

export function isCmsSurface(v: string): v is CmsSurface {
  return SURFACE_SET.has(v);
}

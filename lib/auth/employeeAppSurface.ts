import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { isEmployeeAllowedAppSurfacePath } from "@/lib/auth/employeeAppSurfacePath";

export { isEmployeeAllowedAppSurfacePath };

/**
 * Kaller fra `app/(app)/layout.tsx`: ansatt utenfor /week → /week.
 * Forutsetter at middleware setter `x-pathname` (se middleware.ts).
 */
export async function enforceEmployeeWeekOnlyOnAppShell(): Promise<void> {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  if (!pathname) return;
  if (isEmployeeAllowedAppSurfacePath(pathname)) return;

  const auth = await getAuthContext();
  if (auth.ok && auth.role === "employee") {
    redirect("/week");
  }
}

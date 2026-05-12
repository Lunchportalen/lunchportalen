/**
 * Employee app-shell: /week og /meny er tillatt som hovedflater under (app)-layout.
 * Brukes av `employeeAppSurface.ts` og tester (ingen server-only).
 */
export function isEmployeeAllowedAppSurfacePath(pathname: string): boolean {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return p === "/week" || p.startsWith("/week/") || p === "/meny" || p.startsWith("/meny/");
}

/**
 * Employee app-shell: kun /week (og /week/*) er tillatt som hovedflate under (app)-layout.
 * Brukes av `employeeAppSurface.ts` og tester (ingen server-only).
 */
export function isEmployeeAllowedAppSurfacePath(pathname: string): boolean {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return p === "/week" || p.startsWith("/week/");
}

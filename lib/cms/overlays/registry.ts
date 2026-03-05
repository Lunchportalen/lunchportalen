/**
 * App overlay CMS: single source of truth mapping app routes to overlay slug keys.
 */
export const APP_OVERLAYS = {
  week: { slug: "app-overlay-week", title: "Week (Employee overlay)", previewPath: "/week" },
  dashboard: { slug: "app-overlay-dashboard", title: "Dashboard (Employee overlay)", previewPath: "/dashboard" },
  companyAdmin: { slug: "app-overlay-company-admin", title: "Company Admin (overlay)", previewPath: "/admin" },
  superadmin: { slug: "app-overlay-superadmin", title: "Superadmin (overlay)", previewPath: "/superadmin" },
  kitchen: { slug: "app-overlay-kitchen", title: "Kitchen (overlay)", previewPath: "/kitchen" },
  driver: { slug: "app-overlay-driver", title: "Driver (overlay)", previewPath: "/driver" },
} as const;

export type AppOverlayKey = keyof typeof APP_OVERLAYS;

export function getOverlaySlug(key: AppOverlayKey): string {
  return APP_OVERLAYS[key].slug;
}

export function getOverlayPreviewPath(key: AppOverlayKey): string {
  return APP_OVERLAYS[key].previewPath;
}

export function getPreviewPathForOverlaySlug(slug: string | null): string | null {
  if (!slug || typeof slug !== "string") return null;
  const s = slug.trim();
  for (const entry of Object.values(APP_OVERLAYS)) {
    if (entry.slug === s) return entry.previewPath;
  }
  return null;
}

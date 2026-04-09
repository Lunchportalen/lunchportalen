import type { CmsSurface } from "@/lib/cms/surfaces";

/**
 * How a route ties into CMS storage.
 * - `content_pages.slug` for block-based marketing/public pages
 * - `global_content` key `settings` for structured copy under `surfaceCopy` (see cmsContent.ts)
 * - `none` for app shells that are not yet backed by a single CMS page (still AI-scoped by surface)
 */
export type CmsStorageKind = "content_page_slug" | "global_settings" | "none";

export type SurfaceContentBinding = {
  surface: CmsSurface;
  storage: CmsStorageKind;
  /** Published CMS page slug when storage === "content_page_slug" */
  slug?: string;
  /** Logical node id for editor tree / traceability (stable string, not necessarily DB id) */
  nodeId: string;
  notes?: string;
};

export type SurfaceRouteRule = {
  /** Normalized pathname prefix match, e.g. "/admin" */
  pathPrefix: string;
  binding: SurfaceContentBinding;
};

/**
 * Longest-prefix wins when resolving pathname → surface.
 * Order is not significant; rules are sorted at resolve time.
 */
export const SURFACE_ROUTE_RULES: SurfaceRouteRule[] = [
  {
    pathPrefix: "/backoffice",
    binding: {
      surface: "ai_overview",
      storage: "none",
      nodeId: "backoffice:root",
      notes: "Backoffice shell + CMS editor; share AI tooling surface until a dedicated surface exists",
    },
  },
  {
    pathPrefix: "/login",
    binding: {
      surface: "employee_app",
      storage: "global_settings",
      nodeId: "auth:login",
    },
  },
  {
    pathPrefix: "/registrering",
    binding: {
      surface: "onboarding",
      storage: "global_settings",
      nodeId: "auth:registrering",
    },
  },
  {
    pathPrefix: "/public/demo",
    binding: {
      surface: "public_demo",
      storage: "content_page_slug",
      slug: "demo",
      nodeId: "public:demo",
      notes: "Public demo shell; may also use settings.surfaceCopy.public_demo.*",
    },
  },
  {
    pathPrefix: "/backoffice/ai/overview",
    binding: {
      surface: "ai_overview",
      storage: "none",
      nodeId: "backoffice:ai:overview",
    },
  },
  {
    pathPrefix: "/backoffice/ai",
    binding: {
      surface: "ai_overview",
      storage: "none",
      nodeId: "backoffice:ai",
    },
  },
  {
    pathPrefix: "/onboarding",
    binding: {
      surface: "onboarding",
      storage: "global_settings",
      nodeId: "app:onboarding",
      notes: "Copy under settings.surfaceCopy.onboarding — do not change onboarding contracts",
    },
  },
  {
    pathPrefix: "/superadmin",
    binding: {
      surface: "superadmin_dashboard",
      storage: "global_settings",
      nodeId: "app:superadmin",
    },
  },
  {
    pathPrefix: "/admin",
    binding: {
      surface: "company_admin_dashboard",
      storage: "global_settings",
      nodeId: "app:company_admin",
    },
  },
  {
    pathPrefix: "/kitchen",
    binding: {
      surface: "kitchen_view",
      storage: "global_settings",
      nodeId: "app:kitchen",
    },
  },
  {
    pathPrefix: "/driver",
    binding: {
      surface: "driver_view",
      storage: "global_settings",
      nodeId: "app:driver",
    },
  },
  {
    pathPrefix: "/week",
    binding: {
      surface: "week_view",
      storage: "global_settings",
      nodeId: "app:week",
    },
  },
  {
    pathPrefix: "/portal/week",
    binding: {
      surface: "week_view",
      storage: "global_settings",
      nodeId: "app:portal:week",
    },
  },
  {
    pathPrefix: "/min-side",
    binding: {
      surface: "employee_app",
      storage: "global_settings",
      nodeId: "app:min-side",
    },
  },
  {
    pathPrefix: "/orders",
    binding: {
      surface: "employee_app",
      storage: "global_settings",
      nodeId: "app:orders",
    },
  },
  {
    pathPrefix: "/today",
    binding: {
      surface: "employee_app",
      storage: "global_settings",
      nodeId: "app:today",
    },
  },
  {
    pathPrefix: "/",
    binding: {
      surface: "public_home",
      storage: "content_page_slug",
      slug: "",
      nodeId: "public:home",
      notes: "Marketing home often slug \"\" or resolved via getContentBySlug in routes",
    },
  },
];

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function pathMatchesPrefix(path: string, prefix: string): boolean {
  if (prefix === "/") return path === "/";
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Pick the most specific (longest) matching prefix rule. */
export function resolveSurfaceBinding(pathname: string): SurfaceContentBinding | null {
  const path = normalizePathname(pathname);
  let best: SurfaceRouteRule | null = null;
  for (const rule of SURFACE_ROUTE_RULES) {
    const p = rule.pathPrefix;
    if (!pathMatchesPrefix(path, p)) continue;
    if (!best || p.length > best.pathPrefix.length) best = rule;
  }
  return best?.binding ?? null;
}

const DEFAULT_PUBLIC_BINDING: SurfaceContentBinding = {
  surface: "public_home",
  storage: "content_page_slug",
  slug: "",
  nodeId: "public:marketing:default",
  notes: "Used when no explicit rule matches (e.g. top-level marketing pages)",
};

/**
 * Same as resolveSurfaceBinding, but falls back to public_home for unknown paths
 * so public marketing routes remain CMS-addressable without listing every slug.
 */
export function resolveSurfaceBindingWithDefault(pathname: string): SurfaceContentBinding {
  return resolveSurfaceBinding(pathname) ?? DEFAULT_PUBLIC_BINDING;
}

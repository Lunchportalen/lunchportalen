import "server-only";

import type { CmsSurface } from "@/lib/cms/surfaces";

/**
 * Product Operating System — canonical surfaces (routes / personas).
 * Narrower than {@link CmsSurface}; mapped for CMS + experiments + AI scope.
 */
export type ProductSurface =
  | "public_demo"
  | "onboarding"
  | "backoffice_editor"
  | "superadmin_dashboard"
  | "company_admin"
  | "employee"
  | "kitchen"
  | "driver"
  | "week";

export const PRODUCT_SURFACES: readonly ProductSurface[] = [
  "public_demo",
  "onboarding",
  "backoffice_editor",
  "superadmin_dashboard",
  "company_admin",
  "employee",
  "kitchen",
  "driver",
  "week",
] as const;

export type PosCmsUsage = {
  /** Whether this surface is primarily CMS-backed content. */
  reads_cms_pages: boolean;
  /** Global settings / header-footer involvement. */
  uses_global_fragments: boolean;
  /** Closest {@link CmsSurface} for experiment + learning namespacing. */
  cms_surface: CmsSurface | null;
};

export type PosAiCapability = {
  /** Editor / page intelligence / suggestions (no auto-publish). */
  analysis_and_suggest: boolean;
  /** Structured generation (menus, blocks) — preview in editor only. */
  structured_generate: boolean;
};

export type PosGrowthTracking = {
  /** Use content_analytics_events or product-specific trackers. */
  content_analytics: boolean;
  /** Experiment assign + results (lib/experiments). */
  experiments: boolean;
  /** Primary conversion proxy for this surface. */
  primary_goal: "conversion" | "completion" | "engagement" | "operations" | "observability";
};

export type ProductSurfaceConfig = {
  surface: ProductSurface;
  label: string;
  cms: PosCmsUsage;
  ai: PosAiCapability;
  growth: PosGrowthTracking;
};

const REGISTRY: Record<ProductSurface, ProductSurfaceConfig> = {
  public_demo: {
    surface: "public_demo",
    label: "Offentlig demo",
    cms: {
      reads_cms_pages: true,
      uses_global_fragments: true,
      cms_surface: "public_demo",
    },
    ai: { analysis_and_suggest: true, structured_generate: true },
    growth: {
      content_analytics: true,
      experiments: true,
      primary_goal: "conversion",
    },
  },
  onboarding: {
    surface: "onboarding",
    label: "Onboarding",
    cms: {
      reads_cms_pages: false,
      uses_global_fragments: false,
      cms_surface: "onboarding",
    },
    ai: { analysis_and_suggest: true, structured_generate: false },
    growth: {
      content_analytics: true,
      experiments: true,
      primary_goal: "completion",
    },
  },
  backoffice_editor: {
    surface: "backoffice_editor",
    label: "Backoffice CMS-redaktør",
    cms: {
      reads_cms_pages: true,
      uses_global_fragments: true,
      cms_surface: "ai_overview",
    },
    ai: { analysis_and_suggest: true, structured_generate: true },
    growth: {
      content_analytics: false,
      experiments: false,
      primary_goal: "engagement",
    },
  },
  superadmin_dashboard: {
    surface: "superadmin_dashboard",
    label: "Superadmin",
    cms: {
      reads_cms_pages: true,
      uses_global_fragments: false,
      cms_surface: "superadmin_dashboard",
    },
    ai: { analysis_and_suggest: true, structured_generate: false },
    growth: {
      content_analytics: false,
      experiments: true,
      primary_goal: "observability",
    },
  },
  company_admin: {
    surface: "company_admin",
    label: "Firmaadmin",
    cms: {
      reads_cms_pages: false,
      uses_global_fragments: false,
      cms_surface: "company_admin_dashboard",
    },
    ai: { analysis_and_suggest: true, structured_generate: false },
    growth: {
      content_analytics: false,
      experiments: true,
      primary_goal: "engagement",
    },
  },
  employee: {
    surface: "employee",
    label: "Ansatt",
    cms: {
      reads_cms_pages: false,
      uses_global_fragments: false,
      cms_surface: "employee_app",
    },
    ai: { analysis_and_suggest: false, structured_generate: false },
    growth: {
      content_analytics: false,
      experiments: true,
      primary_goal: "engagement",
    },
  },
  kitchen: {
    surface: "kitchen",
    label: "Kjøkken",
    cms: {
      reads_cms_pages: false,
      uses_global_fragments: false,
      cms_surface: "kitchen_view",
    },
    ai: { analysis_and_suggest: false, structured_generate: false },
    growth: {
      content_analytics: false,
      experiments: false,
      primary_goal: "operations",
    },
  },
  driver: {
    surface: "driver",
    label: "Sjåfør",
    cms: {
      reads_cms_pages: false,
      uses_global_fragments: false,
      cms_surface: "driver_view",
    },
    ai: { analysis_and_suggest: false, structured_generate: false },
    growth: {
      content_analytics: false,
      experiments: false,
      primary_goal: "operations",
    },
  },
  week: {
    surface: "week",
    label: "Uke / bestilling",
    cms: {
      reads_cms_pages: false,
      uses_global_fragments: false,
      cms_surface: "week_view",
    },
    ai: { analysis_and_suggest: false, structured_generate: false },
    growth: {
      content_analytics: false,
      experiments: true,
      primary_goal: "engagement",
    },
  },
};

export function getProductSurfaceConfig(surface: ProductSurface): ProductSurfaceConfig {
  return REGISTRY[surface];
}

export function listProductSurfaceConfigs(): ProductSurfaceConfig[] {
  return PRODUCT_SURFACES.map((s) => REGISTRY[s]);
}

/** Map POS surface to CMS experiment / learning namespace. */
export function productSurfaceToCmsSurface(surface: ProductSurface): CmsSurface | null {
  return REGISTRY[surface].cms.cms_surface;
}

/**
 * Design system: all generated CMS suggestions should use the same token contract as analyzers/generators.
 * Re-exported at runtime from {@link @/lib/ai/designTokens} — single source of truth.
 */
export { designTokensPromptFragment, getCmsDesignTokens } from "@/lib/ai/designTokens";
export type { CmsDesignTokens } from "@/lib/ai/designTokens";

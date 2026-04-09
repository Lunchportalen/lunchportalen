export type HeaderNavItem = { label: string; href: string };

export type HeaderShellViewModel = {
  title: string;
  areaLabel: string;
  logoSrc: string;
  navigation: HeaderNavItem[];
};

/** Keys under `global_content.header.data.headerNavByVariant` (backoffice editor). */
export function mapScopeRoleToHeaderNavVariant(role: string | null | undefined): string {
  const r = String(role ?? "").trim().toLowerCase();
  if (r === "superadmin") return "superadmin";
  if (r === "company_admin" || r === "companyadmin" || r === "admin") return "company-admin";
  if (r === "employee") return "employee";
  if (r === "kitchen") return "kitchen";
  if (r === "driver") return "driver";
  return "public";
}

function cmsDataRecord(cmsJson: unknown): Record<string, unknown> | null {
  if (!cmsJson || typeof cmsJson !== "object" || Array.isArray(cmsJson)) return null;
  const root = cmsJson as Record<string, unknown>;
  const inner = root.data;
  if (inner && typeof inner === "object" && inner !== null && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return root;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function normalizeNavigation(data: Record<string, unknown> | null): HeaderNavItem[] {
  if (!data) return [];
  const nav = data.navigation ?? data.nav;
  if (!Array.isArray(nav)) return [];
  const out: HeaderNavItem[] = [];
  for (const item of nav) {
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    const label = typeof it.label === "string" ? it.label.trim() : "";
    const href = typeof it.href === "string" ? it.href.trim() : "";
    if (!label || !href) continue;
    out.push({ label, href });
  }
  return out;
}

/**
 * Shared by server `HeaderShell` and client preview chrome (same parsing as canonical header).
 * @param navVariantKey — optional key in `data.headerNavByVariant` (from {@link mapScopeRoleToHeaderNavVariant}).
 *        When set and a block exists, title + navigation come from that block; logo/areaLabel stay global.
 */
export function headerShellViewModelFromCmsJson(cmsJson: unknown, navVariantKey?: string | null): HeaderShellViewModel {
  const data = cmsDataRecord(cmsJson);

  let variantBlock: Record<string, unknown> | null = null;
  if (navVariantKey && data && isPlainObject(data.headerNavByVariant)) {
    const hv = data.headerNavByVariant as Record<string, unknown>;
    const b = hv[navVariantKey];
    if (isPlainObject(b)) variantBlock = b;
  }

  const navigation = variantBlock ? normalizeNavigation(variantBlock) : normalizeNavigation(data);

  const logoRaw = data && typeof data.logo === "string" ? data.logo.trim() : null;
  const logo = logoRaw && logoRaw.startsWith("/") ? logoRaw : null;

  const title = (() => {
    if (variantBlock) {
      const vt = variantBlock.title;
      if (typeof vt === "string" && vt.trim() !== "") return vt.trim();
    }
    return data && typeof data.title === "string" && data.title.trim() !== "" ? data.title.trim() : "Lunchportalen";
  })();

  const areaLabel =
    data && typeof data.areaLabel === "string" && data.areaLabel.trim() !== ""
      ? data.areaLabel.trim()
      : data && typeof data.area_label === "string" && data.area_label.trim() !== ""
        ? data.area_label.trim()
        : "Hovedmeny";

  const logoSrc = logo ?? "/brand/LP-logo-uten-bakgrunn.png";

  return { title, areaLabel, logoSrc, navigation };
}

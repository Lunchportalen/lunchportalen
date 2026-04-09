// src/components/nav/HeaderShell.tsx
import "server-only";

import HeaderShellView from "@/components/nav/HeaderShellView";
import { getGlobalHeader } from "@/lib/content/getGlobalHeader";
import {
  headerShellViewModelFromCmsJson,
  mapScopeRoleToHeaderNavVariant,
} from "@/lib/layout/globalHeaderFromCms";
import { getHeaderVariantClass, type HeaderVariant } from "@/lib/ui/headerVariants";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

async function resolveHeaderScopeForShell(): Promise<{ email: string | null; navVariantKey: string }> {
  try {
    const { getScopeServer } = await import("@/lib/auth/getScopeServer");
    const { scope, user } = await getScopeServer();
    return {
      email: (scope.email as string | null) ?? (user?.email ?? null),
      navVariantKey: mapScopeRoleToHeaderNavVariant(scope.role),
    };
  } catch {
    return { email: null, navVariantKey: "public" };
  }
}

/** Canonical header shell. Pass variant for lp-header-* (glass/soft/gradient/outline/glow); omit for default. Structure: lp-topbar from globals. */
export default async function HeaderShell(props: {
  variant?: HeaderVariant;
  /** From `marketingHeaderInnerGridClass(getDesignSettings())` — aligns shell width with CMS layout.container. */
  innerGridClassName?: string;
}) {
  const { variant, innerGridClassName } = props;
  const cmsHeader = await getGlobalHeader();
  const { email, navVariantKey } = await resolveHeaderScopeForShell();
  const headerModel = headerShellViewModelFromCmsJson(cmsHeader, navVariantKey);

  const headerClassName = variant
    ? cn("lp-topbar", getHeaderVariantClass(variant))
    : "border-b border-[rgb(var(--lp-border))] bg-white";

  const innerGrid =
    innerGridClassName?.trim() ||
    "mx-auto grid w-full max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-4 py-3 md:py-4";

  return (
    <HeaderShellView
      {...headerModel}
      email={email}
      headerClassName={headerClassName}
      innerGridClassName={innerGrid}
    />
  );
}

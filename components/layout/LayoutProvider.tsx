"use client";

import type { ReactNode } from "react";

import { layoutRegistry } from "@/lib/layout/registry";
import { resolveLayout, type ResolveLayoutInput } from "@/lib/layout/resolveLayout";

type LayoutProviderProps = {
  role?: string | null | undefined;
  pathname: string;
  treatAsPublicSitePreview?: boolean;
  children: ReactNode;
};

export default function LayoutProvider({ role, pathname, treatAsPublicSitePreview, children }: LayoutProviderProps) {
  const input: ResolveLayoutInput = {
    role: role ?? undefined,
    pathname,
    treatAsPublicSitePreview,
  };
  const type = resolveLayout(input);
  const Layout = layoutRegistry[type];

  return <Layout>{children}</Layout>;
}

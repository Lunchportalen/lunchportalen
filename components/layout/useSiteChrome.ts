"use client";

import { useEffect, useMemo, useState } from "react";

import {
  marketingFooterInnerClass,
  marketingHeaderInnerGridClass,
  parseDesignSettingsFromSettingsData,
  type ParsedDesignSettings,
} from "@/lib/cms/design/designContract";
import { footerShellViewModelFromCmsJson } from "@/lib/layout/globalFooterFromCms";
import {
  headerShellViewModelFromCmsJson,
  mapScopeRoleToHeaderNavVariant,
} from "@/lib/layout/globalHeaderFromCms";
import { getFooterVariantClass, type FooterVariant } from "@/lib/ui/footerVariants";
import { getHeaderVariantClass, type HeaderVariant } from "@/lib/ui/headerVariants";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

type ContainerMode = "container" | "full";

export type SiteChromeSurface = "marketing" | "app";

type MePayload = {
  email?: string | null;
  role?: string | null;
};

function parseMeJson(json: unknown): MePayload | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const root = json as Record<string, unknown>;
  if (root.ok !== true) return null;
  const data = root.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const user = d.user;
  if (!user || typeof user !== "object" || Array.isArray(user)) return null;
  const u = user as Record<string, unknown>;
  const email = typeof u.email === "string" ? u.email : null;
  const role = typeof u.role === "string" ? u.role : null;
  return { email, role };
}

export function useSiteChrome(surface: SiteChromeSurface, headerVariant?: HeaderVariant, footerVariant?: FooterVariant) {
  const [headerModel, setHeaderModel] = useState(() => headerShellViewModelFromCmsJson(null));
  const [footerModel, setFooterModel] = useState(() => footerShellViewModelFromCmsJson(null));
  const [designSettings, setDesignSettings] = useState<ParsedDesignSettings | null>(() =>
    parseDesignSettingsFromSettingsData(null),
  );
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headerP = fetch("/api/content/global/header", { credentials: "include" }).then((r) => r.json().catch(() => null));
        const footerP = fetch("/api/content/global/footer", { credentials: "include" }).then((r) => r.json().catch(() => null));
        const meP = fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json().catch(() => null));

        const settingsP =
          surface === "marketing"
            ? fetch("/api/content/global/settings", { credentials: "include" }).then((r) => r.json().catch(() => null))
            : Promise.resolve(null);

        const [headerJson, footerJson, meJson, settingsJson] = await Promise.all([headerP, footerP, meP, settingsP]);

        if (cancelled) return;

        const me = parseMeJson(meJson);
        const navVariantKey = mapScopeRoleToHeaderNavVariant(me?.role);
        setHeaderModel(headerShellViewModelFromCmsJson(headerJson, navVariantKey));
        setFooterModel(footerShellViewModelFromCmsJson(footerJson));

        setEmail(me?.email ?? null);

        if (surface === "marketing") {
          const data =
            settingsJson && typeof settingsJson === "object" && settingsJson !== null && !Array.isArray(settingsJson)
              ? (settingsJson as Record<string, unknown>).data
              : null;
          setDesignSettings(parseDesignSettingsFromSettingsData(data));
        }
      } catch {
        if (!cancelled) {
          setHeaderModel(headerShellViewModelFromCmsJson(null));
          setFooterModel(footerShellViewModelFromCmsJson(null));
          setEmail(null);
          if (surface === "marketing") setDesignSettings(parseDesignSettingsFromSettingsData(null));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [surface]);

  const headerClassName = headerVariant ? cn("lp-topbar", getHeaderVariantClass(headerVariant)) : "border-b border-[rgb(var(--lp-border))] bg-white";

  const innerGridClassName = useMemo(() => {
    if (surface === "marketing") {
      const cls = marketingHeaderInnerGridClass(designSettings);
      return cls?.trim() || "mx-auto grid w-full max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-4 py-3 md:py-4";
    }
    return "mx-auto grid w-full max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-4 py-3 md:py-4";
  }, [surface, designSettings]);

  const footerClassName = cn("lp-footer lp-footer--full", getFooterVariantClass(footerVariant));

  const innerFooterMax = useMemo(() => {
    const containerMode: ContainerMode = "full";
    if (surface === "marketing" && designSettings != null) {
      return marketingFooterInnerClass(designSettings, containerMode);
    }
    return containerMode === "full" ? "lp-footer-shell" : "lp-footer-shell lp-max-1400";
  }, [surface, designSettings]);

  return {
    email,
    headerModel,
    footerModel,
    headerClassName,
    innerGridClassName,
    footerClassName,
    innerFooterMax,
  };
}

"use client";

// STATUS: KEEP

import { useState } from "react";
import {
  DEFAULT_THEME_FONT_BY_ROLE,
  resolveThemeFontByRole,
  type FontRole,
  type ThemeFontOption,
} from "@/lib/design/fontRegistry";

export function useContentWorkspaceUiState() {
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [createPanelMode, setCreatePanelMode] = useState<"choose" | "form">("choose");
  const [globalPanelTab, setGlobalPanelTab] = useState<"global" | "content" | "info">("global");
  const [globalSubView, setGlobalSubView] = useState<
    null | "content-and-settings" | "header" | "navigation" | "footer" | "reusable-components"
  >(null);
  const [headerVariant, setHeaderVariant] = useState<
    null | "public" | "company-admin" | "superadmin" | "employee" | "kitchen" | "driver"
  >(null);
  const [headerEditConfig, setHeaderEditConfig] = useState<{
    title: string;
    nav: Array<{ label: string; href: string; exact?: boolean }>;
  } | null>(null);
  const [headerEditLoading, setHeaderEditLoading] = useState(false);
  const [headerEditSaving, setHeaderEditSaving] = useState(false);
  const [headerEditError, setHeaderEditError] = useState<string | null>(null);
  const [contentSettingsTab, setContentSettingsTab] = useState<
    "general" | "analytics" | "form" | "shop" | "globalContent" | "notification" | "scripts" | "advanced"
  >("general");
  const [navigationTab, setNavigationTab] = useState<
    "main" | "secondary" | "footer" | "member" | "cta" | "language" | "advanced"
  >("main");
  const [hideMainNavigation, setHideMainNavigation] = useState(false);
  const [hideSecondaryNavigation, setHideSecondaryNavigation] = useState(false);
  const [hideFooterNavigation, setHideFooterNavigation] = useState(false);
  const [hideMemberNavigation, setHideMemberNavigation] = useState(false);
  const [hideCtaNavigation, setHideCtaNavigation] = useState(false);
  const [hideLanguageNavigation, setHideLanguageNavigation] = useState(true);
  const [multilingualMode, setMultilingualMode] = useState<"multiSite" | "oneToOne">("oneToOne");
  const [footerTab, setFooterTab] = useState<"content" | "advanced">("content");
  const [designTab, setDesignTab] = useState<
    "Layout" | "Logo" | "Colors" | "Spacing" | "Fonts" | "Backgrounds" | "CSS" | "JavaScript" | "Advanced"
  >("Layout");
  const [themeFontByRole, setThemeFontByRole] = useState<Record<FontRole, ThemeFontOption>>(
    () => resolveThemeFontByRole(DEFAULT_THEME_FONT_BY_ROLE)
  );
  const [colorsContentBg, setColorsContentBg] = useState("#f5d385");
  const [colorsButtonBg, setColorsButtonBg] = useState("#f8e7a0");
  const [colorsButtonText, setColorsButtonText] = useState("#000000");
  const [colorsButtonBorder, setColorsButtonBorder] = useState("#6e5338");
  const [labelColors, setLabelColors] = useState<
    Array<{ background: string; text: string }>
  >([
    { background: "#dc2626", text: "#ffffff" },
    { background: "#b91c1c", text: "#ffffff" },
    { background: "#ec4899", text: "#ffffff" },
    { background: "#dc2626", text: "#ffffff" },
    { background: "#ef4444", text: "#000000" },
    { background: "#f97316", text: "#000000" },
  ]);
  const [contentDirection, setContentDirection] = useState<"ltr" | "rtl">("ltr");
  const [emailPlatform, setEmailPlatform] = useState<"campaignMonitor" | "mailchimp" | null>("mailchimp");
  const [captchaVersion, setCaptchaVersion] = useState<
    "recaptchaV2" | "recaptchaV3" | "hcaptcha" | "turnstile"
  >("hcaptcha");
  const [notificationEnabled, setNotificationEnabled] = useState(false);

  const [createTitle, setCreateTitle] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createSlugTouched, setCreateSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createDocumentTypeAlias, setCreateDocumentTypeAlias] = useState<string | null>(null);
  const [allowedChildTypes, setAllowedChildTypes] = useState<string[]>([]);
  const [createParentLoading, setCreateParentLoading] = useState(false);

  const [bannerPanelTab, setBannerPanelTab] = useState<"content" | "settings">("content");
  const [bannerSettingsSubTab, setBannerSettingsSubTab] = useState<"layout" | "animation" | "advanced">("layout");
  const [showPreviewColumn, setShowPreviewColumn] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<
    "innhold" | "ekstra" | "oppsummering" | "navigasjon" | "seo" | "cro" | "aimaal" | "scripts" | "avansert"
  >("innhold");

  return {
    createPanelOpen,
    setCreatePanelOpen,
    createPanelMode,
    setCreatePanelMode,
    globalPanelTab,
    setGlobalPanelTab,
    globalSubView,
    setGlobalSubView,
    headerVariant,
    setHeaderVariant,
    headerEditConfig,
    setHeaderEditConfig,
    headerEditLoading,
    setHeaderEditLoading,
    headerEditSaving,
    setHeaderEditSaving,
    headerEditError,
    setHeaderEditError,
    contentSettingsTab,
    setContentSettingsTab,
    navigationTab,
    setNavigationTab,
    hideMainNavigation,
    setHideMainNavigation,
    hideSecondaryNavigation,
    setHideSecondaryNavigation,
    hideFooterNavigation,
    setHideFooterNavigation,
    hideMemberNavigation,
    setHideMemberNavigation,
    hideCtaNavigation,
    setHideCtaNavigation,
    hideLanguageNavigation,
    setHideLanguageNavigation,
    multilingualMode,
    setMultilingualMode,
    footerTab,
    setFooterTab,
    designTab,
    setDesignTab,
    themeFontByRole,
    setThemeFontByRole,
    colorsContentBg,
    setColorsContentBg,
    colorsButtonBg,
    setColorsButtonBg,
    colorsButtonText,
    setColorsButtonText,
    colorsButtonBorder,
    setColorsButtonBorder,
    labelColors,
    setLabelColors,
    contentDirection,
    setContentDirection,
    emailPlatform,
    setEmailPlatform,
    captchaVersion,
    setCaptchaVersion,
    notificationEnabled,
    setNotificationEnabled,
    createTitle,
    setCreateTitle,
    createSlug,
    setCreateSlug,
    createSlugTouched,
    setCreateSlugTouched,
    creating,
    setCreating,
    createError,
    setCreateError,
    createDocumentTypeAlias,
    setCreateDocumentTypeAlias,
    allowedChildTypes,
    setAllowedChildTypes,
    createParentLoading,
    setCreateParentLoading,
    bannerPanelTab,
    setBannerPanelTab,
    bannerSettingsSubTab,
    setBannerSettingsSubTab,
    showPreviewColumn,
    setShowPreviewColumn,
    editOpen,
    setEditOpen,
    editIndex,
    setEditIndex,
    activeTab,
    setActiveTab,
  };
}


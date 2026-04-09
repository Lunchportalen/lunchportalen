"use client";

import { useState } from "react";

export type MediaPickerTarget = {
  blockId: string;
  itemId?: string;
  field: "imageUrl" | "videoUrl" | "heroImageUrl" | "heroBleedBackground" | "heroBleedOverlay";
};

/**
 * Lokal UI-/presentasjonsstate: sideliste, global design-flate, mediapicker.
 * Ingen dataflow/save/preview-kilde — kun visnings- og paneltilstand.
 */
export function useContentWorkspacePresentationState() {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [hjemExpanded, setHjemExpanded] = useState(true);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [createPanelMode, setCreatePanelMode] = useState<"choose" | "form">("choose");

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
  const [hideMainNavigation, setHideMainNavigation] = useState(false);
  const [hideSecondaryNavigation, setHideSecondaryNavigation] = useState(false);
  const [hideFooterNavigation, setHideFooterNavigation] = useState(false);
  const [hideMemberNavigation, setHideMemberNavigation] = useState(false);
  const [hideCtaNavigation, setHideCtaNavigation] = useState(false);
  const [hideLanguageNavigation, setHideLanguageNavigation] = useState(true);
  const [multilingualMode, setMultilingualMode] = useState<"multiSite" | "oneToOne">("oneToOne");
  const [colorsContentBg, setColorsContentBg] = useState("#f5d385");
  const [colorsButtonBg, setColorsButtonBg] = useState("#f8e7a0");
  const [colorsButtonText, setColorsButtonText] = useState("#000000");
  const [colorsButtonBorder, setColorsButtonBorder] = useState("#6e5338");
  const [labelColors, setLabelColors] = useState<Array<{ background: string; text: string }>>([
    { background: "#dc2626", text: "#ffffff" },
    { background: "#b91c1c", text: "#ffffff" },
    { background: "#ec4899", text: "#ffffff" },
    { background: "#dc2626", text: "#ffffff" },
    { background: "#ef4444", text: "#000000" },
    { background: "#f97316", text: "#000000" },
  ]);
  const [contentDirection, setContentDirection] = useState<"ltr" | "rtl">("ltr");
  const [emailPlatform, setEmailPlatform] = useState<"campaignMonitor" | "mailchimp" | null>("mailchimp");
  const [captchaVersion, setCaptchaVersion] = useState<"recaptchaV2" | "recaptchaV3" | "hcaptcha" | "turnstile">(
    "hcaptcha"
  );
  const [notificationEnabled, setNotificationEnabled] = useState(false);

  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<MediaPickerTarget | null>(null);

  return {
    queryInput,
    setQueryInput,
    query,
    setQuery,
    hjemExpanded,
    setHjemExpanded,
    createPanelOpen,
    setCreatePanelOpen,
    createPanelMode,
    setCreatePanelMode,
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
    mediaPickerOpen,
    setMediaPickerOpen,
    mediaPickerTarget,
    setMediaPickerTarget,
  };
}

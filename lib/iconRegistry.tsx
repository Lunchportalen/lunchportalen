/**
 * LUNCHPORTALEN — Semantic icon registry.
 * Select icons by meaning (e.g. "add", "warning") instead of importing components directly.
 * Single source for intent-based icon usage.
 */

import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconClock,
  IconCompany,
  IconContent,
  IconCrop,
  IconDriver,
  IconEdit,
  IconForm,
  IconFolder,
  IconGlobe,
  IconHome,
  IconInfo,
  IconInvoice,
  IconKitchen,
  IconLoader,
  IconLocation,
  IconLock,
  IconLogOut,
  IconMedia,
  IconMember,
  IconMenu,
  IconOrder,
  IconPlus,
  IconRecycle,
  IconReleases,
  IconRefreshCw,
  IconSearch,
  IconSeo,
  IconSettings,
  IconShield,
  IconSparkles,
  IconTemplate,
  IconTranslation,
  IconUsers,
  IconWarning,
  IconX,
} from "@/lib/icons";

export type SemanticIconKey =
  | "add"
  | "edit"
  | "delete"
  | "search"
  | "settings"
  | "menu"
  | "company"
  | "location"
  | "employee"
  | "kitchen"
  | "driver"
  | "order"
  | "invoice"
  | "media"
  | "seo"
  | "ai"
  | "warning"
  | "success"
  | "info"
  | "close"
  | "content"
  | "logout"
  | "chevronUp"
  | "chevronDown"
  | "chevronRight"
  | "loading"
  | "clock"
  | "shield"
  | "refresh"
  | "home"
  | "lock"
  | "globe"
  | "crop"
  | "template"
  | "users"
  | "form"
  | "translation"
  | "releases"
  | "folder";

export type IconComponent = ComponentType<LucideProps>;

/** Semantic key → icon component. Prefer getIcon(key) for dynamic lookup. */
export const iconRegistry: Record<SemanticIconKey, IconComponent> = {
  add: IconPlus,
  edit: IconEdit,
  delete: IconRecycle,
  search: IconSearch,
  settings: IconSettings,
  menu: IconMenu,
  company: IconCompany,
  location: IconLocation,
  employee: IconMember,
  kitchen: IconKitchen,
  driver: IconDriver,
  order: IconOrder,
  invoice: IconInvoice,
  media: IconMedia,
  seo: IconSeo,
  ai: IconSparkles,
  warning: IconWarning,
  success: IconCheck,
  info: IconInfo,
  close: IconX,
  content: IconContent,
  logout: IconLogOut,
  chevronUp: IconChevronUp,
  chevronDown: IconChevronDown,
  chevronRight: IconChevronRight,
  loading: IconLoader,
  clock: IconClock,
  shield: IconShield,
  refresh: IconRefreshCw,
  home: IconHome,
  lock: IconLock,
  globe: IconGlobe,
  crop: IconCrop,
  template: IconTemplate,
  users: IconUsers,
  form: IconForm,
  translation: IconTranslation,
  releases: IconReleases,
  folder: IconFolder,
};

/** Returns the icon component for a semantic key. Use for intent-based icon selection. */
export function getIcon(key: SemanticIconKey): IconComponent {
  return iconRegistry[key];
}

/** All valid semantic icon keys (for validation or UI). */
export const SEMANTIC_ICON_KEYS: readonly SemanticIconKey[] = [
  "add",
  "edit",
  "delete",
  "search",
  "settings",
  "menu",
  "company",
  "location",
  "employee",
  "kitchen",
  "driver",
  "order",
  "invoice",
  "media",
  "seo",
  "ai",
  "warning",
  "success",
  "info",
  "close",
  "content",
  "logout",
  "chevronUp",
  "chevronDown",
  "chevronRight",
  "loading",
  "clock",
  "shield",
  "refresh",
  "home",
  "lock",
  "globe",
  "crop",
  "template",
  "users",
  "form",
  "translation",
  "releases",
  "folder",
] as const;
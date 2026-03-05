/**
 * Phase 18: CMS plugin types.
 * Shared by registry (client/server), loadPlugins, and runHooks.
 */

import type { ReactNode } from "react";

export type CMSHookContext = {
  env: "prod" | "staging";
  locale: "nb" | "en";
  pageId: string;
  variantId: string;
  slug: string;
};

export type CMSBlockDefinition = {
  type: string;
  label: string;
  description?: string;
  category: "content" | "layout" | "navigation" | "system" | "marketing";
  icon?: string;
  defaults: () => Record<string, unknown>;
  previewText?: (data: Record<string, unknown>) => string;
  allowedEnvironments?: ("prod" | "staging" | "preview")[];
};

export type CMSInspectorExtension = {
  blockType: string;
  render?: (props: {
    data: Record<string, unknown>;
    onChange: (next: Record<string, unknown>) => void;
  }) => ReactNode;
};

export type CMSHooks = {
  onPublish?: (ctx: CMSHookContext) => Promise<void>;
  onExpire?: (ctx: CMSHookContext) => Promise<void>;
  onSearchIndex?: (
    ctx: CMSHookContext & { action: "upsert" | "delete" }
  ) => Promise<void>;
};

export type CMSPlugin = {
  id: string;
  name: string;
  enabledByDefault?: boolean;
  blocks?: CMSBlockDefinition[];
  inspector?: CMSInspectorExtension[];
  hooks?: CMSHooks;
};

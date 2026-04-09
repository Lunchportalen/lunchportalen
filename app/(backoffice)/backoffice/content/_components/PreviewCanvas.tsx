"use client";

import { Component, type ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import LayoutProvider from "@/components/layout/LayoutProvider";
import PageShell from "@/components/PageShell";
import {
  buildEffectiveParsedDesignSettingsLayered,
  type ParsedDesignSettings,
} from "@/lib/cms/design/designContract";
import { renderBlock } from "@/lib/public/blocks/renderBlock";
import { normalizeBlockForRender } from "@/lib/cms/public/normalizeBlockForRender";
import { VisualInlineBlockChrome } from "./VisualInlineBlockChrome";

const LOCALE: "nb" | "en" = "nb";

function getPublicEnv(): "prod" | "staging" {
  return typeof process.env.NEXT_PUBLIC_APP_ENV === "string" && process.env.NEXT_PUBLIC_APP_ENV === "staging"
    ? "staging"
    : "prod";
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Catches render errors for a single block so the rest of the preview still works. */
class BlockPreviewErrorBoundary extends Component<{ children: ReactNode; blockId: string }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: true } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
          role="status"
        >
          Kan ikke forhåndsvise denne blokken.
        </div>
      );
    }
    return this.props.children;
  }
}

export type PublicPageMeta = {
  slug?: string;
};

export type PreviewBlock = { id: string; type: string } & Record<string, unknown>;

/** Optional visual inline editing on live preview (backoffice only). */
export type PublicPageVisualInlineEdit = {
  enabled: boolean;
  onPatchBlock: (blockId: string, patch: Record<string, unknown>) => void;
  onRemoveBlock: (blockId: string) => void;
  onReplaceHeroBleedImage?: (blockId: string, which: "background" | "overlay") => void;
  onOpenAdvancedEditor?: (blockId: string) => void;
  fieldHintsByBlockId?: Record<string, Record<string, string>>;
};

export type PublicPageRendererProps = {
  blocks: PreviewBlock[];
  title: string;
  /** Reserved for future SEO / slug context (same contract as editor call sites). */
  meta?: PublicPageMeta;
  /** Saved page body `meta` — layered design (pageDesign / sectionDesign). */
  pageCmsMeta?: Record<string, unknown> | null;
  pageId?: string | null;
  variantId?: string | null;
  /**
   * When set (e.g. split preview rail), blocks are clickable for editor sync.
   * Omit for read-only canvas (full preview mode).
   */
  onSelectBlock?: (blockId: string) => void;
  selectedBlockId?: string | null;
  hoverBlockId?: string | null;
  onHoverBlock?: (blockId: string | null) => void;
  visualInlineEdit?: PublicPageVisualInlineEdit | null;
};

/**
 * Same markup and pipeline as `app/(public)/[slug]/page.tsx`:
 * `normalizeBlockForRender` → `renderBlock` with identical ENV/LOCALE rules.
 */
export function PublicPageRenderer({
  blocks,
  title,
  meta: _meta,
  pageCmsMeta = null,
  pageId = null,
  variantId = null,
  onSelectBlock,
  selectedBlockId = null,
  hoverBlockId = null,
  onHoverBlock,
  visualInlineEdit = null,
}: PublicPageRendererProps) {
  void _meta;
  const pathname = usePathname() || "/";
  const ENV = getPublicEnv();
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  const visualCanvasEditOpts =
    visualInlineEdit?.enabled ?
      {
        enabled: true as const,
        selectedBlockId,
        onPatchBlock: visualInlineEdit.onPatchBlock,
      }
    : null;
  const [globalSettingsDataRoot, setGlobalSettingsDataRoot] = useState<Record<string, unknown> | null>(null);
  const [userRole, setUserRole] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (cancelled || !json || json.ok !== true) return;
        const data = json.data;
        if (!data || typeof data !== "object" || Array.isArray(data)) return;
        const user = (data as Record<string, unknown>).user;
        if (!user || typeof user !== "object" || Array.isArray(user)) return;
        const role = (user as Record<string, unknown>).role;
        if (typeof role === "string" && role.trim()) setUserRole(role.trim());
      } catch {
        /* unauthenticated preview — role stays undefined */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/content/global/settings", { credentials: "include" });
        const json = (await res.json().catch(() => null)) as { data?: unknown } | null;
        if (cancelled) return;
        const data =
          json && typeof json.data === "object" && json.data !== null && !Array.isArray(json.data)
            ? (json.data as Record<string, unknown>)
            : {};
        setGlobalSettingsDataRoot(data);
      } catch {
        if (!cancelled) setGlobalSettingsDataRoot({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LayoutProvider pathname={pathname} role={userRole} treatAsPublicSitePreview>
      <PageShell>
        <article className="lp-container mx-auto max-w-4xl px-4 py-8">
          {title ? <h1 className="lp-h1 mb-6 text-[rgb(var(--lp-text))]">{title}</h1> : null}
          <div className="flex flex-col gap-6">
            {safeBlocks.map((block, i) => {
              const node = normalizeBlockForRender(block ?? null, i);
              const designSettings: ParsedDesignSettings = buildEffectiveParsedDesignSettingsLayered(
                globalSettingsDataRoot ?? {},
                pageCmsMeta ?? null,
                node.config?.sectionId ?? null,
              );
              let inner = (
                <BlockPreviewErrorBoundary blockId={node.id}>
                  {renderBlock(node, ENV, LOCALE, {
                    designSettings,
                    visualCanvasEdit: visualCanvasEditOpts,
                  })}
                </BlockPreviewErrorBoundary>
              );
              const useVisual = Boolean(visualInlineEdit?.enabled && onSelectBlock);
              if (useVisual) {
                const isSel = block.id === selectedBlockId;
                const isHov = block.id === hoverBlockId && !isSel;
                inner = (
                  <VisualInlineBlockChrome
                    block={block}
                    isSelected={isSel}
                    isHovered={isHov}
                    enabled
                    fieldHints={visualInlineEdit.fieldHintsByBlockId?.[block.id]}
                    onPatch={(patch) => visualInlineEdit.onPatchBlock(block.id, patch)}
                    onRemove={() => visualInlineEdit.onRemoveBlock(block.id)}
                    onReplaceBackground={
                      block.type === "hero_bleed" ?
                        () => visualInlineEdit.onReplaceHeroBleedImage?.(block.id, "background")
                      : undefined
                    }
                    onReplaceOverlay={
                      block.type === "hero_bleed" ?
                        () => visualInlineEdit.onReplaceHeroBleedImage?.(block.id, "overlay")
                      : undefined
                    }
                    onOpenAdvanced={
                      visualInlineEdit.onOpenAdvancedEditor ?
                        () => visualInlineEdit.onOpenAdvancedEditor?.(block.id)
                      : undefined
                    }
                  >
                    {inner}
                  </VisualInlineBlockChrome>
                );
              }
              if (onSelectBlock) {
                const isSel = block.id === selectedBlockId;
                const isHov = block.id === hoverBlockId && !isSel;
                const focusDim =
                  Boolean(useVisual && selectedBlockId && block.id !== selectedBlockId);
                return (
                  <div
                    key={node.id}
                    data-block-id={block.id}
                    data-analytics-page-id={pageId ?? undefined}
                    data-analytics-variant-id={variantId ?? undefined}
                    data-lp-preview-block-wrap="1"
                    className={cn(
                      "group/preview-block cursor-pointer rounded-md transition-[transform,opacity] duration-200 ease-out",
                      isSel && "relative z-[1] ring-2 ring-pink-400/55 md:scale-[1.004]",
                      isHov && "ring-1 ring-pink-300/70 md:scale-[1.002]",
                      focusDim && "opacity-[0.4]",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBlock(block.id);
                    }}
                    onMouseEnter={() => onHoverBlock?.(block.id)}
                    onMouseLeave={() => onHoverBlock?.(null)}
                  >
                    {inner}
                  </div>
                );
              }
              return <div key={node.id}>{inner}</div>;
            })}
          </div>
          {safeBlocks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-800">Start med en seksjon</p>
              <p className="mt-1 text-xs text-slate-500">Legg til en blokk i redigeringsfeltet — forhåndsvisningen oppdateres straks.</p>
            </div>
          ) : null}
        </article>
      </PageShell>
    </LayoutProvider>
  );
}

export type PreviewDeviceId = "desktop" | "tablet" | "mobile";

export type PreviewCanvasProps = {
  device: PreviewDeviceId;
  blocks: PreviewBlock[];
  title: string;
  meta?: PublicPageMeta;
  pageCmsMeta?: Record<string, unknown> | null;
  pageId?: string | null;
  variantId?: string | null;
  className?: string;
};

/** Full-width preview shell with device frame; inner page uses real public renderer. */
export function PreviewCanvas({
  device,
  blocks,
  title,
  meta,
  pageCmsMeta,
  pageId,
  variantId,
  className,
}: PreviewCanvasProps) {
  return (
    <div
      className={cn(
        "w-full overflow-clip rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/35 transition-all duration-300",
        device === "tablet" && "mx-auto max-w-[768px]",
        device === "mobile" && "mx-auto max-w-[390px]",
        className,
      )}
      data-lp-preview-canvas
    >
      <div className="max-h-[min(78vh,900px)] cursor-default overflow-y-auto bg-white" style={{ scrollbarGutter: "stable" }}>
        <PublicPageRenderer
          blocks={blocks}
          title={title}
          meta={meta}
          pageCmsMeta={pageCmsMeta}
          pageId={pageId}
          variantId={variantId}
        />
      </div>
    </div>
  );
}

/**
 * Ren prop-assembly for ContentWorkspaceAuxiliaryShell — ingen ny forretningslogikk.
 */

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { HistoryPreviewPayload, RestoredPagePayload } from "./ContentPageVersionHistory";
import type { Block } from "./editorBlockTypes";
import {
  parseBodyToBlocks,
  snapshotBodyFromPageBody,
  type BodyParseResult,
} from "./contentWorkspace.blocks";
import type { PageStatus } from "./contentWorkspace.types";
import { makeSnapshot, safeStr } from "./contentWorkspace.helpers";
import { CMS_DRAFT_ENVIRONMENT } from "@/lib/cms/cmsDraftEnvironment";
import { normalizeEditorLocale } from "./contentWorkspace.preview";
import type { ContentWorkspaceAuxiliaryShellProps } from "./ContentWorkspaceAuxiliaryShell";
import type { ContentPage } from "./ContentWorkspaceState";
import type { SaveState } from "./types";
import { parseBodyEnvelope } from "./_stubs";

export type BuildContentWorkspaceAuxiliaryShellPropsArgs = {
  isDemo: boolean;
  isWow: boolean;
  effectiveId: string | null;
  page: ContentPage | null;
  /** U98 — variant row locale for historikk / preview APIs (nb | en). */
  editorLocale: string;
  isOffline: boolean;
  detailLoading: boolean;
  pageNotFound: boolean;
  detailError: unknown;
  selectedId: string;
  saving: boolean;
  canSave: boolean;
  onSaveAndPreview: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  setHistoryVersionPreview: (p: HistoryPreviewPayload | null) => void;
  setShowPreviewColumn: (v: boolean) => void;
  clearAutosaveTimer: () => void;
  setTitle: (v: string) => void;
  setSlug: (v: string) => void;
  setSlugTouched: (v: boolean) => void;
  applyParsedBody: (parsed: BodyParseResult) => void;
  setSavedSnapshot: (s: ReturnType<typeof makeSnapshot>) => void;
  setPage: Dispatch<SetStateAction<ContentPage | null>>;
  updateSidebarItem: (next: ContentPage) => void;
  setLastSavedAt: (v: string) => void;
  setSaveStateSafe: (s: SaveState) => void;
  setLastError: (v: string | null) => void;
  isPitch: boolean;
  aiProduct: string;
  setAiProduct: (v: string) => void;
  aiAudience: string;
  setAiAudience: (v: string) => void;
  aiIntent: string;
  setAiIntent: (v: string) => void;
  runAiBuild: () => void | Promise<void>;
  aiBuildLoading: boolean;
  runAiAudit: () => void | Promise<void>;
  aiAuditLoading: boolean;
  onboardingStep: number;
  setOnboardingStep: (n: number | ((p: number) => number)) => void;
  aiBuildResult: unknown[] | null;
  setBlocks: Dispatch<SetStateAction<Block[]>>;
  selectedBlock: Block | null;
  imagePresetLabels: Record<string, string>;
  imagePreset: string;
  setImagePreset: (k: string) => void;
  runAiImage: () => void | Promise<void>;
  runAiImageBatch: () => void | Promise<void>;
  aiAnyLoading: boolean;
  aiImageLoading: boolean;
  aiBatchLoading: boolean;
  runAiAction: (kind: "improve" | "shorten" | "seo") => void | Promise<void>;
  aiBatchProgress: { done: number; total: number };
  aiImages: { url: string }[] | null;
  applyImage: (picked: { url: string; assetId?: string }) => void;
  demoBlocks: Block[];
  setSelectedBlockId: (id: string | null) => void;
  setOriginalBlocks: (b: Block[]) => void;
  setShowAfter: (v: boolean | ((p: boolean) => boolean)) => void;
  wowHasRunRef: MutableRefObject<boolean>;
};

export function buildContentWorkspaceAuxiliaryShellProps(
  a: BuildContentWorkspaceAuxiliaryShellPropsArgs
): ContentWorkspaceAuxiliaryShellProps {
  return {
    lowerControls: {
      isDemo: a.isDemo,
      versionHistory: {
        pageId: a.effectiveId ?? "",
        locale: normalizeEditorLocale(a.editorLocale),
        environment: CMS_DRAFT_ENVIRONMENT,
        pageUpdatedAt: a.page?.updated_at ?? null,
        disabled:
          !a.effectiveId ||
          a.isOffline ||
          a.detailLoading ||
          a.pageNotFound ||
          Boolean(a.detailError),
        onApplyHistoryPreview: (payload) => {
          a.setHistoryVersionPreview(payload);
          a.setShowPreviewColumn(true);
        },
        onApplyRestoredPage: (restored: RestoredPagePayload) => {
          a.setHistoryVersionPreview(null);
          a.clearAutosaveTimer();
          const nextTitle = safeStr(restored.title);
          const nextSlug = safeStr(restored.slug);
          const envelope = parseBodyEnvelope(restored.body);
          const parsedBody = parseBodyToBlocks(envelope.blocksBody);
          const snapshotBody = snapshotBodyFromPageBody(restored.body);
          a.setTitle(nextTitle);
          a.setSlug(nextSlug);
          a.setSlugTouched(false);
          a.applyParsedBody(parsedBody);
          a.setSavedSnapshot(
            makeSnapshot({
              title: nextTitle,
              slug: nextSlug,
              body: snapshotBody,
            })
          );
          const st: PageStatus = restored.status === "published" ? "published" : "draft";
          a.setPage((prev) =>
            prev
              ? {
                  ...prev,
                  id: restored.id,
                  title: nextTitle,
                  slug: nextSlug,
                  status: st,
                  created_at: restored.created_at ?? prev.created_at,
                  updated_at: restored.updated_at ?? prev.updated_at,
                  published_at: restored.published_at ?? prev.published_at,
                  body: restored.body,
                }
              : null
          );
          a.updateSidebarItem({
            id: restored.id,
            title: nextTitle,
            slug: nextSlug,
            status: st,
            created_at: restored.created_at,
            updated_at: restored.updated_at,
            published_at: restored.published_at,
            body: restored.body,
          });
          a.setLastSavedAt(restored.updated_at ?? new Date().toISOString());
          a.setSaveStateSafe("saved");
          a.setLastError(null);
        },
      },
      saveBar: {
        selectedId: a.selectedId,
        saving: a.saving,
        canSave: a.canSave,
        onSaveAndPreview: a.onSaveAndPreview,
        onSave: () => void a.onSave(),
      },
    },
    demo: a.isDemo
      ? {
          isWow: a.isWow,
          onRestart: () => {
            a.setBlocks(a.demoBlocks);
            a.setSelectedBlockId(a.demoBlocks[0]?.id ?? null);
            if (a.isWow) {
              a.setOriginalBlocks(JSON.parse(JSON.stringify(a.demoBlocks)) as Block[]);
              a.setShowAfter(false);
              a.wowHasRunRef.current = false;
            }
          },
          onToggleBeforeAfter: () => a.setShowAfter((prev) => !prev),
        }
      : null,
    aiInputs: {
      isPitch: a.isPitch,
      aiProduct: a.aiProduct,
      setAiProduct: a.setAiProduct,
      aiAudience: a.aiAudience,
      setAiAudience: a.setAiAudience,
      aiIntent: a.aiIntent,
      setAiIntent: a.setAiIntent,
      runAiBuild: a.runAiBuild,
      aiBuildLoading: a.aiBuildLoading,
      runAiAudit: a.runAiAudit,
      aiAuditLoading: a.aiAuditLoading,
      onboardingStep: a.onboardingStep,
      setOnboardingStep: a.setOnboardingStep,
    },
    aiBuildResult: a.aiBuildResult,
    onApplyAiBuild: () => {
      if (!a.aiBuildResult) return;
      a.setBlocks(a.aiBuildResult as Block[]);
      const first = a.aiBuildResult[0] as { id?: unknown } | undefined;
      a.setSelectedBlockId(typeof first?.id === "string" ? first.id : null);
    },
    selectedBlockTools:
      a.selectedBlock && !a.isPitch
        ? {
            block: a.selectedBlock,
            imagePresetLabels: a.imagePresetLabels,
            imagePreset: a.imagePreset,
            setImagePreset: a.setImagePreset,
            runAiImage: a.runAiImage,
            runAiImageBatch: a.runAiImageBatch,
            aiAnyLoading: a.aiAnyLoading,
            aiImageLoading: a.aiImageLoading,
            aiBatchLoading: a.aiBatchLoading,
            runAiAction: a.runAiAction,
            onboardingStep: a.onboardingStep,
            setOnboardingStep: a.setOnboardingStep,
          }
        : null,
    aiBatchProgress: a.aiBatchProgress,
    aiImages: a.aiImages,
    onPickAiImage: a.applyImage,
  };
}

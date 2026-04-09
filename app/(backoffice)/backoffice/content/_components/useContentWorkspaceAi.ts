"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { applyAIPatchV1 } from "@/lib/cms/model/applyAIPatch";
import { isAIPatchV1 } from "@/lib/cms/model/aiPatch";
import {
  parseMetaToPageAiContract,
  mergeContractIntoMeta,
} from "@/lib/cms/model/pageAiContractHelpers";
import type { PageAiContract } from "@/lib/cms/model/pageAiContract";
import { appendDiagnosticsSuggestion } from "./pageAiContractEditorUtils";
import { logEditorAiEvent } from "@/domain/backoffice/ai/metrics/logEditorAiEvent";
import type { EditorAiFeature } from "@/domain/backoffice/ai/metrics/editorAiMetricsTypes";
import { extractAiSummary } from "./contentWorkspace.helpers";
import {
  type AiToolId,
  AI_TOOL_TO_FEATURE,
  buildAiBlocks,
  buildAiExistingBlocks,
  buildAiMeta,
  normalizeAiApiError,
} from "./contentWorkspace.ai";
import { normalizeBlock } from "./contentWorkspace.blocks";
import type { Block } from "./editorBlockTypes";
import {
  type SuggestRequest,
  parseBackofficeAiJson,
  parseSuggestPayload,
  parseBlockBuilderResponse,
  parseScreenshotBuilderResponse,
  parseLayoutSuggestionsResponse,
  parseImageGeneratorResponse,
  parsePageBuilderResponse,
  parseCapabilityResponse,
} from "./editorAiContracts";
import {
  fetchBackofficeGetJson,
  fetchBackofficePostJson,
  fetchBackofficeSuggestRequest,
} from "./contentWorkspace.aiRequests";
import { logApiRidFromBody } from "./contentWorkspace.api";
import { extractWorkspaceBlockText } from "./contentWorkspaceImagePromptShell";
import { neighborAiPreamble } from "./contentWorkspacePresentationSelectors";
import { validateEditorBlockTypesForGovernedApply } from "@/lib/cms/legacyEnvelopeGovernance";
import { useBlockEditorDataTypesMergedOptional } from "./BlockEditorDataTypesMergedContext";
import { useDocumentTypeDefinitionsMergedOptional } from "./DocumentTypeDefinitionsMergedContext";

export type AiCapabilityStatus = "loading" | "available" | "unavailable";

/** Editor blocks shape passed to onApplySuggestPatch (id, type, plus block data). */
export type EditorBlockForPatch = Array<{
  id: string;
  type: string;
  [key: string]: unknown;
}>;

export type UseContentWorkspaceAiDeps = {
  effectiveId: string | null;
  selectedId: string;
  blocks: Block[];
  meta: Record<string, unknown>;
  title: string;
  slug: string;
  /** U26: når satt, forhåndsvaliderer AI-patch mot blokkallowliste (typeliste). */
  documentTypeAlias: string | null;
  /** Apply suggest result to editor (ContentWorkspace does parseBodyToBlocks + applyParsedBody). */
  onApplySuggestPatch: (
    editorBlocks: EditorBlockForPatch,
    mergedMeta: Record<string, unknown>
  ) => void;
  /** Merge diagnostics (and optionally other contract fields) into meta. ContentWorkspace does setMeta(prev => mergeContractIntoMeta(prev, contract)). */
  onMergeDiagnostics: (contract: Partial<PageAiContract>) => void;
};

export function shouldStartAiAction(currentBusyId: string | null, requestedId: string): boolean {
  if (!currentBusyId) return true;
  // Block overlapping actions when any tool is already busy.
  // Duplicate starts for the same tool are also ignored.
  return false;
}

export function useContentWorkspaceAi(deps: UseContentWorkspaceAiDeps) {
  const {
    effectiveId,
    selectedId,
    blocks,
    meta,
    title,
    slug,
    documentTypeAlias,
    onApplySuggestPatch,
    onMergeDiagnostics,
  } = deps;

  const bdtMerged = useBlockEditorDataTypesMergedOptional();
  const mergedBlockEditorDataTypes = bdtMerged?.data?.merged ?? null;
  const docMerged = useDocumentTypeDefinitionsMergedOptional();
  const mergedDocumentTypeDefinitions = docMerged?.data?.merged ?? null;

  const [aiBusyToolId, setAiBusyToolId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiBlockBuilderResult, setAiBlockBuilderResult] = useState<{
    block: Record<string, unknown>;
    message: string;
    /** Set when result is produced; apply only when effectiveId === pageId. */
    pageId?: string | null;
  } | null>(null);
  const [aiPageBuilderResult, setAiPageBuilderResult] = useState<{
    title?: string;
    summary?: string;
    blocks: Array<{ id: string; type: string; data: Record<string, unknown> }>;
    warnings?: string[];
    droppedBlocks?: Array<{ index: number; type: string }>;
    /** Set when result is produced; apply only when effectiveId === pageId. */
    pageId?: string | null;
  } | null>(null);
  const [aiScreenshotBuilderResult, setAiScreenshotBuilderResult] = useState<{
    message?: string;
    blocks: unknown[];
    blockTypes?: string[];
    warnings?: string[];
    /** Set when result is produced; apply only when effectiveId === pageId. */
    pageId?: string | null;
  } | null>(null);
  const [lastLayoutSuggestionsResult, setLastLayoutSuggestionsResult] = useState<{
    suggestions: Array<{
      kind: string;
      title: string;
      reason: string;
      priority: string;
      previewLabel?: string;
      applyPatch?: unknown;
    }>;
    message: string;
  } | null>(null);
  const [designSuggestionsDismissed, setDesignSuggestionsDismissed] = useState<Set<string>>(new Set());
  const [designSuggestionsApplied, setDesignSuggestionsApplied] = useState<Set<string>>(new Set());
  const [lastGeneratedImageResult, setLastGeneratedImageResult] = useState<import("./editorAiContracts").ImageGeneratorResult | null>(null);
  const [aiLastAppliedTool, setAiLastAppliedTool] = useState<string | null>(
    null
  );
  const [aiLastActionFeature, setAiLastActionFeature] =
    useState<EditorAiFeature | null>(null);
  const [aiCapability, setAiCapability] =
    useState<AiCapabilityStatus>("loading");
  const [diagnosticsResult, setDiagnosticsResult] = useState<{
    improvePage: { summary: string; applied: boolean };
    seo: { summary: string; applied: boolean };
  } | null>(null);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [aiHistory, setAiHistory] = useState<
    Array<{ id: string; tool: string; label: string; detail?: string; at: string }>
  >([]);

  /** Current effectiveId for stale-response checks. Apply only when response context matches. */
  const effectiveIdRef = useRef<string | null>(effectiveId);
  useEffect(() => {
    effectiveIdRef.current = effectiveId;
  }, [effectiveId]);

  /** Clear page-bound AI state when effectiveId changes so apply actions only see results for the current page. */
  useEffect(() => {
    setAiSummary(null);
    setAiPageBuilderResult(null);
    setAiScreenshotBuilderResult(null);
    setLastLayoutSuggestionsResult(null);
    setDiagnosticsResult(null);
    setAiBlockBuilderResult(null);
    setLastGeneratedImageResult(null);
    setDesignSuggestionsDismissed(new Set());
    setDesignSuggestionsApplied(new Set());
  }, [effectiveId]);

  const reportAiError = useCallback(
    (message: string, opts?: { kind?: string; feature?: EditorAiFeature | null }) => {
      setAiError(message);
      logEditorAiEvent({
        type: "ai_error",
        pageId: effectiveId ?? null,
        variantId: null,
        timestamp: new Date().toISOString(),
        message,
        kind: opts?.kind ?? "unknown",
        feature: opts?.feature ?? null,
      });
    },
    [effectiveId]
  );

  const pushAiHistory = useCallback(
    (tool: string, label: string, detail?: string) => {
      const at = new Date().toISOString();
      const id = `ai_${at}_${Math.random().toString(36).slice(2, 9)}`;
      setAiHistory((prev) =>
        [{ id, tool, label, detail, at }, ...prev].slice(0, 10)
      );
    },
    []
  );

  const callAiSuggest = useCallback(
    async (
      tool: Exclude<AiToolId, "block.builder">,
      input: Record<string, unknown>,
      options?: { metricsFeature?: EditorAiFeature }
    ): Promise<unknown> => {
      const metricsFeature = options?.metricsFeature;
      if (!shouldStartAiAction(aiBusyToolId, tool)) {
        return null;
      }
      const requestContextId = effectiveId;
      const blocksLengthAtRequest = blocks.length;
      setAiBusyToolId(tool);
      setAiError(null);
      setAiSummary(null);
      try {
        const body: SuggestRequest = {
          tool,
          pageId: effectiveId ?? null,
          variantId: null,
          environment: "preview",
          locale: "nb",
          input,
          blocks: buildAiBlocks(blocks),
          existingBlocks: buildAiExistingBlocks(blocks),
          meta: buildAiMeta(meta),
          pageTitle: title || undefined,
          pageSlug: slug || undefined,
        };
        const { ok: httpOk, json, status: httpStatus } = await fetchBackofficeSuggestRequest(body);
        if (!httpOk) {
          const parsed = parseBackofficeAiJson(json);
          const msg =
            parsed && !parsed.ok
              ? parsed.message
              : normalizeAiApiError(httpStatus, json);
          reportAiError(msg, {
            kind: "api",
            feature: metricsFeature ?? AI_TOOL_TO_FEATURE[tool] ?? null,
          });
          return null;
        }
        const parsed = parseBackofficeAiJson(json);
        if (parsed === null) {
          reportAiError("Ugyldig svar fra AI.", {
            kind: "api",
            feature: metricsFeature ?? AI_TOOL_TO_FEATURE[tool] ?? null,
          });
          return null;
        }
        if (!parsed.ok) {
          reportAiError(parsed.message ?? "AI-forespørsel feilet.", {
            kind: "api",
            feature: metricsFeature ?? AI_TOOL_TO_FEATURE[tool] ?? null,
          });
          return null;
        }
        const payload = parseSuggestPayload(parsed.data);
        if (payload === null) {
          reportAiError("Ugyldig svar fra AI.", {
            kind: "api",
            feature: metricsFeature ?? AI_TOOL_TO_FEATURE[tool] ?? null,
          });
          return null;
        }
        /** Stale guard: do not apply or set page-bound state when response belongs to another page. */
        const isStaleResponse = effectiveIdRef.current !== requestContextId;
        if (isStaleResponse) return payload;

        const summary = payload.summary ?? extractAiSummary(tool, payload);
        if (summary) setAiSummary(summary);
        setAiLastAppliedTool(null);

        if (metricsFeature) {
          logEditorAiEvent({
            type: "ai_result_received",
            feature: metricsFeature,
            pageId: effectiveId ?? null,
            variantId: null,
            patchPresent: Boolean(payload.patch),
            timestamp: new Date().toISOString(),
          });
        }

        if (payload.patch) {
          /** Do not apply when block structure changed during request; patch was computed for previous structure. */
          if (blocks.length !== blocksLengthAtRequest) {
            setAiSummary("Innholdet har endret seg. Forslag ble ikke brukt.");
            return payload;
          }
          const patch = payload.patch;
          const payloadRecord = payload;
          const bodyForApply = {
            version: 1 as const,
            blocks: buildAiBlocks(blocks).map((b) => ({
              id: b.id,
              type: b.type,
              data: b.data ?? {},
            })),
            meta,
          };
          const applied = applyAIPatchV1(bodyForApply, patch);
          /** Only apply when patch is valid and targets exist; never call onApplySuggestPatch when applied.ok is false. */
          if (applied.ok) {
            const editorBlocks: EditorBlockForPatch = applied.next.blocks.map(
              (n) => ({
                id: n.id,
                type: n.type,
                ...(n.data ?? {}),
              })
            );
            const gov = validateEditorBlockTypesForGovernedApply(
              documentTypeAlias,
              editorBlocks,
              mergedBlockEditorDataTypes,
              mergedDocumentTypeDefinitions,
            );
            if (gov.ok === false) {
              reportAiError(gov.message, { kind: "apply", feature: metricsFeature ?? null });
              return payload;
            }
            const baseMeta = applied.next.meta ?? {};
            let mergedMeta =
              payloadRecord.metaSuggestion != null
                ? mergeContractIntoMeta(baseMeta, {
                    seo: payloadRecord.metaSuggestion,
                  })
                : baseMeta;
            if (
              payloadRecord.metaSuggestion != null &&
              (tool === "seo.optimize.page" || tool === "content.maintain.page")
            ) {
              const newSuggestion =
                tool === "seo.optimize.page"
                  ? "SEO: forslag brukt"
                  : "Improve page: forslag brukt";
              mergedMeta = appendDiagnosticsSuggestion(
                mergedMeta,
                newSuggestion
              );
            }
            onApplySuggestPatch(editorBlocks, mergedMeta);
            setAiLastAppliedTool(tool);
            const toolLabel =
              tool === "content.maintain.page"
                ? "Improve page"
                : tool === "seo.optimize.page"
                  ? "SEO optimize"
                  : tool === "landing.generate.sections"
                    ? "Generate sections"
                    : tool;
            pushAiHistory(tool, toolLabel, "Brukt");
            if (metricsFeature) {
              logEditorAiEvent({
                type: "ai_patch_applied",
                feature: metricsFeature,
                pageId: effectiveId ?? null,
                variantId: null,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
        return payload;
      } catch (e) {
        reportAiError(e instanceof Error ? e.message : "Ukjent AI-feil.", {
          kind: "exception",
          feature:
            metricsFeature ?? AI_TOOL_TO_FEATURE[tool] ?? null,
        });
        return null;
      } finally {
        setAiBusyToolId(null);
      }
    },
    [
      effectiveId,
      blocks,
      meta,
      title,
      slug,
      documentTypeAlias,
      mergedBlockEditorDataTypes,
      mergedDocumentTypeDefinitions,
      reportAiError,
      pushAiHistory,
      onApplySuggestPatch,
      aiBusyToolId,
    ]
  );

  const callDedicatedAiRoute = useCallback(
    async <T = Record<string, unknown>>(params: {
      path: string;
      body: Record<string, unknown>;
      busyId: string;
      getSummary: (data: T) => string | null;
    }): Promise<T | null> => {
      const { path, body, busyId, getSummary } = params;
      if (!shouldStartAiAction(aiBusyToolId, busyId)) {
        return null;
      }
      const requestContextId = effectiveId;
      setAiBusyToolId(busyId);
      setAiError(null);
      setAiSummary(null);
      setAiBlockBuilderResult(null);
      setAiScreenshotBuilderResult(null);
      if (busyId === "layout.suggestions") setLastLayoutSuggestionsResult(null);
      if (busyId === "image.generate.brand_safe") setLastGeneratedImageResult(null);
      try {
        const { ok: httpOk, json, status: httpStatus } = await fetchBackofficePostJson(path, body);
        if (!httpOk) {
          const parsed = parseBackofficeAiJson(json);
          const msg =
            parsed && !parsed.ok
              ? parsed.message
              : normalizeAiApiError(httpStatus, json);
          reportAiError(msg, { kind: "api" });
          return null;
        }
        const parsed = parseBackofficeAiJson(json);
        if (parsed === null || !parsed.ok) {
          reportAiError(
            parsed && !parsed.ok ? parsed.message ?? "AI-forespørsel feilet." : "Ugyldig svar fra AI.",
            { kind: "api" }
          );
          return null;
        }
        const data = parsed.data;
        /** Stale guard: do not set page-bound results when response is for another page. */
        const isStaleResponse = effectiveIdRef.current !== requestContextId;
        if (isStaleResponse) return data as T | null;

        const summary = data ? getSummary(data as T) : null;
        if (summary) setAiSummary(summary);

        if (busyId === "block.builder") {
          const result = parseBlockBuilderResponse(data);
          if (result) {
            setAiBlockBuilderResult({
              ...result,
              pageId: requestContextId ?? null,
            });
          }
        }
        if (busyId === "screenshot.builder") {
          const result = parseScreenshotBuilderResponse(data);
          if (result) {
            setAiScreenshotBuilderResult({
              ...result,
              pageId: requestContextId ?? null,
            });
            if (result.warnings && result.warnings.length > 0) {
              logEditorAiEvent({
                type: "builder_warning",
                feature: "screenshot_builder",
                pageId: effectiveId ?? null,
                timestamp: new Date().toISOString(),
                message: "Screenshot builder returnerte advarsler.",
                count: result.warnings.length,
              });
            }
          }
        }
        if (busyId === "layout.suggestions") {
          const result = parseLayoutSuggestionsResponse(data);
          if (result) {
            setDesignSuggestionsDismissed(new Set());
            setDesignSuggestionsApplied(new Set());
            setLastLayoutSuggestionsResult(result);
          }
        }
        if (busyId === "image.generate.brand_safe") {
          const result = parseImageGeneratorResponse(data);
          if (result) {
            setLastGeneratedImageResult(result);
            pushAiHistory("image_generator", "AI Image Generator", "Promptforslag klare");
          }
        }
        return data as T | null;
      } catch (e) {
        reportAiError(e instanceof Error ? e.message : "Ukjent AI-feil.", {
          kind: "exception",
        });
        return null;
      } finally {
        setAiBusyToolId(null);
      }
    },
    [effectiveId, reportAiError, pushAiHistory, aiBusyToolId]
  );

  const runFullDiagnostics = useCallback(async () => {
    setDiagnosticsResult(null);
    setDiagnosticsBusy(true);
    setAiError(null);
    const contract = parseMetaToPageAiContract(meta);
    const intentAudience = contract.intent?.audience || "";
    try {
      const improvePayload = await callAiSuggest(
        "content.maintain.page",
        {
          goal: "lead",
          audience: intentAudience,
          brand: "Lunchportalen",
          mode: "safe",
        },
        { metricsFeature: "improve_page" }
      );
      const improveSummary =
        (improvePayload &&
          extractAiSummary("content.maintain.page", improvePayload)) ||
        "";
      const improveApplied =
        !!improvePayload &&
        typeof improvePayload === "object" &&
        "patch" in (improvePayload as Record<string, unknown>) &&
        isAIPatchV1((improvePayload as { patch: unknown }).patch);

      setDiagnosticsResult({
        improvePage: { summary: improveSummary, applied: improveApplied },
        seo: { summary: "", applied: false },
      });

      const seoPayload = await callAiSuggest(
        "seo.optimize.page",
        {
          goal: "lead",
          audience: intentAudience,
          brand: "Lunchportalen",
          mode: "safe",
        },
        { metricsFeature: "seo_optimize" }
      );
      const seoSummary =
        (seoPayload && extractAiSummary("seo.optimize.page", seoPayload)) || "";
      const seoApplied =
        !!seoPayload &&
        typeof seoPayload === "object" &&
        "patch" in (seoPayload as Record<string, unknown>) &&
        isAIPatchV1((seoPayload as { patch: unknown }).patch);

      setDiagnosticsResult((prev) =>
        prev
          ? { ...prev, seo: { summary: seoSummary, applied: seoApplied } }
          : {
              improvePage: { summary: "", applied: false },
              seo: { summary: seoSummary, applied: seoApplied },
            }
      );

      pushAiHistory("diagnostics", "Sidediagnostikk", "Improve page + SEO kjørt");
      const diagnosticsLines = [improveSummary, seoSummary].filter(Boolean);
      onMergeDiagnostics({
        diagnostics: {
          lastRun: new Date().toISOString(),
          diagnostics:
            diagnosticsLines.length > 0 ? diagnosticsLines : undefined,
        },
      });
    } finally {
      setDiagnosticsBusy(false);
    }
  }, [meta, callAiSuggest, pushAiHistory, onMergeDiagnostics]);

  const handleAiImprovePage = useCallback(
    (input: { goal: "lead" | "info" | "signup"; audience: string }) => {
      const feature: EditorAiFeature = "improve_page";
      const contract = parseMetaToPageAiContract(meta);
      logEditorAiEvent({
        type: "ai_action_triggered",
        feature,
        pageId: effectiveId ?? null,
        variantId: null,
        timestamp: new Date().toISOString(),
      });
      setAiLastActionFeature(feature);
      void callAiSuggest(
        "content.maintain.page",
        {
          goal: input.goal,
          audience: input.audience || contract.intent?.audience || undefined,
          brand: "Lunchportalen",
          mode: "safe",
        },
        { metricsFeature: feature }
      );
    },
    [meta, effectiveId, callAiSuggest]
  );

  const handleAiSeoOptimize = useCallback(
    (
      input: { goal: "lead" | "info" | "signup"; audience: string },
      opts?: { fromInline?: boolean }
    ) => {
      const feature: EditorAiFeature = opts?.fromInline
        ? "seo_inline"
        : "seo_optimize";
      logEditorAiEvent({
        type: "ai_action_triggered",
        feature,
        pageId: effectiveId ?? null,
        variantId: null,
        timestamp: new Date().toISOString(),
      });
      setAiLastActionFeature(feature);
      const contract = parseMetaToPageAiContract(meta);
      void callAiSuggest(
        "seo.optimize.page",
        {
          goal: input.goal,
          audience: input.audience || contract.intent?.audience || undefined,
          brand: "Lunchportalen",
          mode: "safe",
        },
        { metricsFeature: feature }
      );
    },
    [meta, effectiveId, callAiSuggest]
  );

  const handleAiGenerateSections = useCallback(
    (input: { goal: string; audience: string }) => {
      const feature: EditorAiFeature = "generate_sections";
      logEditorAiEvent({
        type: "ai_action_triggered",
        feature,
        pageId: effectiveId ?? null,
        variantId: null,
        timestamp: new Date().toISOString(),
      });
      setAiLastActionFeature(feature);
      void callAiSuggest(
        "landing.generate.sections",
        {
          goal: input.goal || undefined,
          audience: input.audience || undefined,
          offerName: title || undefined,
          tone: "enterprise",
        },
        { metricsFeature: feature }
      );
    },
    [effectiveId, title, callAiSuggest]
  );

  const handleAiStructuredIntent = useCallback(
    (
      input: { variantCount: 2 | 3; target: "hero_cta" | "hero_only" },
      opts?: { fromPanel?: boolean }
    ) => {
      const feature: EditorAiFeature =
        opts?.fromPanel !== false
          ? "structured_intent"
          : input.target === "hero_only"
            ? "hero_inline"
            : "cta_inline";
      logEditorAiEvent({
        type: "ai_action_triggered",
        feature,
        pageId: effectiveId ?? null,
        variantId: null,
        timestamp: new Date().toISOString(),
      });
      setAiLastActionFeature(feature);
      void callAiSuggest(
        "experiment.generate.variants",
        {
          variantCount: input.variantCount,
          target: input.target,
          goal: "lead",
          brand: "Lunchportalen",
          mode: "safe",
        },
        { metricsFeature: feature }
      );
    },
    [effectiveId, callAiSuggest]
  );

  const handleAiImageGenerate = useCallback(
    (input: { purpose: "hero" | "section" | "social"; topic: string }) => {
      void callDedicatedAiRoute<{
        message?: string;
        imageUrl?: string | null;
      }>({
        path: "/api/backoffice/ai/image-generator",
        body: {
          topic: input.topic,
          purpose: input.purpose,
          locale: "nb",
          brand: "Lunchportalen",
        },
        busyId: "image.generate.brand_safe",
        getSummary: (d) =>
          d.message ?? (Array.isArray((d as { prompts?: unknown[] }).prompts) && (d as { prompts: unknown[] }).prompts.length > 0 ? "Promptforslag klare." : null),
      });
    },
    [callDedicatedAiRoute]
  );

  const handleAiImageImproveMetadata = useCallback(
    (input: { mediaItemId: string; url: string }) => {
      void callDedicatedAiRoute<{ message?: string; alt?: string }>({
        path: "/api/backoffice/ai/image-metadata",
        body: {
          mediaItemId: input.mediaItemId || undefined,
          url: input.url || undefined,
          locale: "nb",
          pageTitle: title || undefined,
        },
        busyId: "image.improve.metadata",
        getSummary: (d) =>
          d.message ?? "Forslag til bilde-metadata er klare.",
      });
    },
    [title, callDedicatedAiRoute]
  );

  const handleLayoutSuggestions = useCallback(() => {
    void callDedicatedAiRoute<{
      message?: string;
      suggestions?: unknown[];
    }>({
      path: "/api/backoffice/ai/layout-suggestions",
      body: {
        blocks: buildAiBlocks(blocks),
        title: title || undefined,
        slug: slug || undefined,
        pageId: effectiveId ?? undefined,
        locale: "nb",
      },
      busyId: "layout.suggestions",
      getSummary: (d) =>
        d.message ??
        (Array.isArray(d.suggestions) && d.suggestions.length > 0
          ? `${d.suggestions.length} layoutforslag.`
          : null),
    });
  }, [blocks, title, slug, effectiveId, callDedicatedAiRoute]);

  const designSuggestionKey = useCallback((s: { kind: string; title: string }) => `${s.kind}:${s.title}`, []);

  const filteredLayoutSuggestionsResult = useMemo(() => {
    if (!lastLayoutSuggestionsResult || lastLayoutSuggestionsResult.suggestions.length === 0) return null;
    const key = designSuggestionKey;
    const visible = lastLayoutSuggestionsResult.suggestions.filter(
      (s) => !designSuggestionsDismissed.has(key(s)) && !designSuggestionsApplied.has(key(s))
    );
    if (visible.length === 0) return { ...lastLayoutSuggestionsResult, suggestions: visible };
    return { ...lastLayoutSuggestionsResult, suggestions: visible };
  }, [lastLayoutSuggestionsResult, designSuggestionsDismissed, designSuggestionsApplied, designSuggestionKey]);

  const handleApplyDesignSuggestion = useCallback(
    async (suggestion: {
      kind: string;
      title: string;
      reason: string;
      priority: string;
      previewLabel?: string;
      applyPatch?: unknown;
    }) => {
      if (!suggestion.applyPatch || !isAIPatchV1(suggestion.applyPatch)) return;
      const bodyForApply = {
        version: 1 as const,
        blocks: buildAiBlocks(blocks).map((b) => ({
          id: b.id,
          type: b.type,
          data: b.data ?? {},
        })),
        meta,
      };
      const applied = applyAIPatchV1(bodyForApply, suggestion.applyPatch);
      if (!applied.ok) {
        reportAiError("reason" in applied ? applied.reason : "Apply failed", { kind: "apply", feature: null });
        return;
      }
      const editorBlocks: EditorBlockForPatch = applied.next.blocks.map((n) => ({
        id: n.id,
        type: n.type,
        ...(n.data ?? {}),
      }));
      const gov = validateEditorBlockTypesForGovernedApply(
        documentTypeAlias,
        editorBlocks,
        mergedBlockEditorDataTypes,
        mergedDocumentTypeDefinitions,
      );
      if (gov.ok === false) {
        reportAiError(gov.message, { kind: "apply", feature: null });
        return;
      }
      onApplySuggestPatch(editorBlocks, applied.next.meta ?? {});
      setDesignSuggestionsApplied((prev) => new Set(prev).add(designSuggestionKey(suggestion)));
      pushAiHistory("layout.suggestions", "Layoutforslag", suggestion.title);
      try {
        await fetchBackofficePostJson("/api/backoffice/ai/design-suggestion/log-apply", {
          kind: suggestion.kind,
          suggestionTitle: suggestion.title,
          pageId: effectiveId ?? undefined,
          locale: "nb",
        });
      } catch {
        // Log failure must not block UX
      }
    },
    [
      blocks,
      meta,
      documentTypeAlias,
      mergedBlockEditorDataTypes,
      mergedDocumentTypeDefinitions,
      onApplySuggestPatch,
      designSuggestionKey,
      reportAiError,
      pushAiHistory,
      effectiveId,
    ]
  );

  const handleDismissDesignSuggestion = useCallback(
    (suggestion: { kind: string; title: string }) => {
      setDesignSuggestionsDismissed((prev) => new Set(prev).add(designSuggestionKey(suggestion)));
    },
    [designSuggestionKey]
  );

  const handleBlockBuilder = useCallback(
    (input: { description: string }) => {
      logEditorAiEvent({
        type: "ai_action_triggered",
        feature: "block_builder",
        pageId: effectiveId ?? null,
        variantId: null,
        timestamp: new Date().toISOString(),
      });
      void callDedicatedAiRoute<{
        message?: string;
        block?: { type?: string };
      }>({
        path: "/api/backoffice/ai/block-builder",
        body: {
          description: input.description.trim(),
          locale: "nb",
          pageId: effectiveId ?? undefined,
        },
        busyId: "block.builder",
        getSummary: (d) =>
          d.message ?? (d.block?.type ? `Blokk generert: ${d.block.type}.` : null),
      });
    },
    [effectiveId, callDedicatedAiRoute]
  );

  const handleScreenshotBuilder = useCallback(
    (input: { screenshotUrl?: string; description?: string }) => {
      logEditorAiEvent({
        type: "ai_action_triggered",
        feature: "screenshot_builder",
        pageId: effectiveId ?? null,
        variantId: null,
        timestamp: new Date().toISOString(),
      });
      void callDedicatedAiRoute<{ message?: string; blocks?: unknown[] }>({
        path: "/api/backoffice/ai/screenshot-builder",
        body: {
          screenshotUrl: input.screenshotUrl?.trim() || undefined,
          description: input.description?.trim() || undefined,
          locale: "nb",
          pageId: effectiveId ?? undefined,
        },
        busyId: "screenshot.builder",
        getSummary: (d) =>
          d.message ??
          (Array.isArray(d.blocks) && d.blocks.length > 0
            ? `Skjermbilde-bootstrap: ${d.blocks.length} blokker.`
            : null),
      });
    },
    [effectiveId, callDedicatedAiRoute]
  );

  const handlePageBuilder = useCallback(
    async (input: {
      prompt?: string;
      goal?: string;
      audience?: string;
      tone?: "enterprise" | "warm" | "neutral";
      pageType?: "landing" | "contact" | "info" | "pricing" | "generic";
      ctaIntent?: "demo" | "contact" | "quote" | "start";
      sectionsInclude?: string[];
      sectionsExclude?: string[];
    }) => {
      if (!shouldStartAiAction(aiBusyToolId, "page.builder")) {
        return;
      }
      if (!effectiveId) {
        reportAiError("Mangler side. Velg en side først.", { kind: "target", feature: "page_builder" });
        return;
      }
      logEditorAiEvent({
        type: "ai_action_triggered",
        feature: "page_builder",
        pageId: effectiveId ?? null,
        variantId: null,
        timestamp: new Date().toISOString(),
      });
      setAiBusyToolId("page.builder");
      setAiError(null);
      setAiSummary(null);
      setAiPageBuilderResult(null);
      const requestContextId = effectiveId;
      const body: Record<string, unknown> = {
        locale: "nb",
        prompt: (input.prompt ?? "").trim() || undefined,
        pageId: effectiveId ?? undefined,
      };
      if (input.goal != null) body.goal = input.goal;
      if (input.audience != null) body.audience = input.audience;
      if (input.tone != null) body.tone = input.tone;
      if (input.pageType != null) body.pageType = input.pageType;
      if (input.ctaIntent != null) body.ctaIntent = input.ctaIntent;
      if (input.sectionsInclude?.length) body.sectionsInclude = input.sectionsInclude;
      if (input.sectionsExclude?.length) body.sectionsExclude = input.sectionsExclude;
      try {
        const { ok: httpOk, json, status: httpStatus } = await fetchBackofficePostJson(
          "/api/backoffice/ai/page-builder",
          body
        );
        if (!httpOk) {
          const parsed = parseBackofficeAiJson(json);
          const msg =
            parsed && !parsed.ok
              ? parsed.message
              : (json && typeof json === "object" && "message" in (json as Record<string, unknown>)
                  ? String((json as { message?: string }).message)
                  : `Feil ${httpStatus}`);
          reportAiError(msg, { kind: "api", feature: "page_builder" });
          return;
        }
        const parsed = parseBackofficeAiJson(json);
        if (parsed === null || !parsed.ok) {
          reportAiError(
            parsed && !parsed.ok ? parsed.message ?? "Kunne ikke generere side." : "Ugyldig svar fra AI.",
            { kind: "api", feature: "page_builder" }
          );
          return;
        }
        const pageResult = parsePageBuilderResponse(parsed.data);
        /** Do not set result when user switched page during request. */
        if (effectiveIdRef.current !== requestContextId) return;
        if (pageResult) {
          if (pageResult.blocks.length === 0) {
            reportAiError("Ingen blokker ble generert. Prøv med annen prompt eller innstillinger.", {
              kind: "api",
              feature: "page_builder",
            });
            return;
          }
          const droppedBlocks: Array<{ index: number; type: string }> = [];
          pageResult.blocks.forEach((n, index) => {
            const normalized = normalizeBlock({
              id: n.id,
              type: n.type,
              ...n.data,
            });
            if (!normalized)
              droppedBlocks.push({
                index,
                type: typeof n.type === "string" ? n.type : "unknown",
              });
          });
          const usableCount = pageResult.blocks.length - droppedBlocks.length;
          if (usableCount === 0) {
            reportAiError("Ingen gyldige blokker kunne brukes. Resultatet matchet ikke sidemodellen.", {
              kind: "parse",
              feature: "page_builder",
            });
            return;
          }
          const warnings = [...(pageResult.warnings ?? [])];
          if (droppedBlocks.length > 0) {
            warnings.push(
              "Noen blokker kunne ikke brukes (ukjent type eller format)."
            );
          }
          const hasWarnings =
            warnings.length > 0 || droppedBlocks.length > 0;
          setAiPageBuilderResult({
            title: pageResult.title,
            summary: pageResult.summary,
            blocks: pageResult.blocks,
            warnings: warnings.length > 0 ? warnings : undefined,
            droppedBlocks:
              droppedBlocks.length > 0 ? droppedBlocks : undefined,
            pageId: requestContextId ?? null,
          });
          if (hasWarnings) {
            logEditorAiEvent({
              type: "builder_warning",
              feature: "page_builder",
              pageId: effectiveId ?? null,
              timestamp: new Date().toISOString(),
              message:
                droppedBlocks.length > 0
                  ? "Page builder droppet blokker (ukjent type eller format)."
                  : "Page builder returnerte advarsler.",
              count: warnings.length + droppedBlocks.length,
            });
          }
          if (pageResult.summary) setAiSummary(pageResult.summary);
        }
      } catch (e) {
        reportAiError(
          e instanceof Error ? e.message : "Kunne ikke generere side.",
          { kind: "exception", feature: "page_builder" }
        );
      } finally {
        setAiBusyToolId(null);
      }
    },
    [effectiveId, reportAiError, aiBusyToolId]
  );

  useEffect(() => {
    if (!selectedId) {
      setAiCapability("loading");
      return;
    }
    let cancelled = false;
    setAiCapability("loading");
    fetchBackofficeGetJson("/api/backoffice/ai/capability")
      .then(({ json }) => json)
      .then((json: unknown) => {
        if (cancelled) return;
        const parsed = parseCapabilityResponse(json);
        const status: AiCapabilityStatus =
          parsed && parsed.enabled ? "available" : "unavailable";
        setAiCapability(status);
      })
      .catch(() => {
        if (!cancelled) setAiCapability("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  return {
    aiBusyToolId,
    aiError,
    setAiError,
    aiSummary,
    setAiSummary,
    aiBlockBuilderResult,
    setAiBlockBuilderResult,
    aiPageBuilderResult,
    setAiPageBuilderResult,
    aiScreenshotBuilderResult,
    setAiScreenshotBuilderResult,
    lastGeneratedImageResult,
    aiLastAppliedTool,
    setAiLastAppliedTool,
    aiLastActionFeature,
    setAiLastActionFeature,
    aiCapability,
    diagnosticsResult,
    diagnosticsBusy,
    aiHistory,
    reportAiError,
    pushAiHistory,
    callAiSuggest,
    callDedicatedAiRoute,
    runFullDiagnostics,
    handleAiImprovePage,
    handleAiSeoOptimize,
    handleAiGenerateSections,
    handleAiStructuredIntent,
    handleAiImageGenerate,
    handleAiImageImproveMetadata,
    handleLayoutSuggestions,
    handleApplyDesignSuggestion,
    handleDismissDesignSuggestion,
    handleBlockBuilder,
    handleScreenshotBuilder,
    handlePageBuilder,
    lastLayoutSuggestionsResult: filteredLayoutSuggestionsResult,
  };
}

export type UseContentWorkspaceRunAiSuggestParams = {
  selectedBlock: Block | null;
  selectedBlockId: string | null;
  blocks: Block[];
  aiBlockRunContext: { userId: string; companyId: string } | null;
  aiCacheRef: MutableRefObject<Record<string, string>>;
  setAiSuggestion: (v: string | null) => void;
  setAiError: (v: string | null) => void;
  setAiScore: (v: number | null) => void;
  setAiHints: (v: string[]) => void;
  setAiSuggestLoading: (v: boolean) => void;
  bumpMetricsAction: () => void;
  bumpMetricsError: () => void;
};

/** Blokk-forslag + score (samme flyt som tidligere i `ContentWorkspace` — ren flytting for linjebudsjett). */
export function useContentWorkspaceRunAiSuggest(p: UseContentWorkspaceRunAiSuggestParams) {
  const {
    selectedBlock,
    selectedBlockId,
    blocks,
    aiBlockRunContext,
    aiCacheRef,
    setAiSuggestion,
    setAiError,
    setAiScore,
    setAiHints,
    setAiSuggestLoading,
    bumpMetricsAction,
    bumpMetricsError,
  } = p;

  return useCallback(async () => {
    if (!selectedBlock) return;
    if (!selectedBlock.id) return;

    const blockId = selectedBlock.id;
    const text = extractWorkspaceBlockText(selectedBlock);
    if (!text || text.length < 2) return;

    const preamble = neighborAiPreamble(blockId, blocks);
    const textForAi = `${preamble}${text}`;
    const key = `${blockId}:${preamble.length}:${text}`;
    const cached = aiCacheRef.current[key];
    if (cached) {
      try {
        if (selectedBlockId !== blockId) return;
        setAiSuggestion(cached);

        const resScore = await fetch("/api/ai/block/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const dataScore: unknown = await resScore.json().catch(() => null);
        logApiRidFromBody(dataScore);
        if (!resScore.ok) {
          console.error("[AI_ACTION_FAILED]", resScore.status);
          setAiError("Kunne ikke hente resultat");
          bumpMetricsError();
          return;
        }
        const scoreBody =
          dataScore && typeof dataScore === "object" ? (dataScore as { ok?: boolean; data?: { score?: unknown; hints?: unknown } }) : null;
        if (!scoreBody || scoreBody.ok !== true) {
          console.error("[AI_ACTION_FAILED]", dataScore);
          setAiError("Kunne ikke hente resultat");
          bumpMetricsError();
          return;
        }
        const score = scoreBody.data?.score ?? null;
        const hints = scoreBody.data?.hints ?? [];
        if (typeof score === "number") {
          setAiScore(score);
          setAiHints(Array.isArray(hints) ? hints.filter((h: unknown) => typeof h === "string") : []);
          bumpMetricsAction();
        }
      } catch (e) {
        console.error("[AI_ACTION_FAILED]", e);
        setAiError("Kunne ikke hente resultat");
        bumpMetricsError();
      }
      return;
    }

    setAiSuggestLoading(true);
    try {
      if (!aiBlockRunContext?.userId || !aiBlockRunContext?.companyId) {
        setAiError("Mangler bruker- eller firmakontekst for AI. Oppdater siden og prøv igjen.");
        setAiSuggestLoading(false);
        return;
      }
      const res = await fetch("/api/ai/block", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: textForAi,
          action: "seo",
          companyId: aiBlockRunContext.companyId,
          userId: aiBlockRunContext.userId,
        }),
      });

      const data: unknown = await res.json().catch(() => null);
      logApiRidFromBody(data);
      if (!res.ok) {
        console.error("[AI_ACTION_FAILED]", res.status);
        setAiError("Kunne ikke hente resultat");
        bumpMetricsError();
        return;
      }
      const blockBody = data && typeof data === "object" ? (data as { ok?: boolean; data?: { result?: unknown } }) : null;
      if (!blockBody || blockBody.ok !== true) {
        console.error("[AI_ACTION_FAILED]", data);
        setAiError("Kunne ikke hente resultat");
        bumpMetricsError();
        return;
      }
      const result = blockBody.data?.result;

      if (typeof result === "string") {
        if (selectedBlockId !== blockId) return;
        aiCacheRef.current[key] = result;
        setAiSuggestion(result);
      } else {
        setAiError("Kunne ikke hente resultat");
        bumpMetricsError();
      }

      const resScore = await fetch("/api/ai/block/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const dataScore: unknown = await resScore.json().catch(() => null);
      logApiRidFromBody(dataScore);
      if (!resScore.ok) {
        console.error("[AI_ACTION_FAILED]", resScore.status);
        setAiError("Kunne ikke hente resultat");
        bumpMetricsError();
        return;
      }
      const scoreParsed =
        dataScore && typeof dataScore === "object" ? (dataScore as { ok?: boolean; data?: { score?: unknown; hints?: unknown } }) : null;
      if (!scoreParsed || scoreParsed.ok !== true) {
        console.error("[AI_ACTION_FAILED]", dataScore);
        setAiError("Kunne ikke hente resultat");
        bumpMetricsError();
        return;
      }
      const score = scoreParsed.data?.score ?? null;
      const hints = scoreParsed.data?.hints ?? [];
      if (typeof score === "number") {
        if (selectedBlockId !== blockId) return;
        setAiScore(score);
        setAiHints(Array.isArray(hints) ? hints.filter((h: unknown) => typeof h === "string") : []);
        bumpMetricsAction();
      }
    } catch (e) {
      console.error("[AI_ACTION_FAILED]", e);
      setAiError("Kunne ikke hente resultat");
      bumpMetricsError();
    } finally {
      setAiSuggestLoading(false);
    }
  }, [
    aiBlockRunContext,
    aiCacheRef,
    blocks,
    bumpMetricsAction,
    bumpMetricsError,
    selectedBlock,
    selectedBlockId,
    setAiError,
    setAiHints,
    setAiScore,
    setAiSuggestion,
    setAiSuggestLoading,
  ]);
}

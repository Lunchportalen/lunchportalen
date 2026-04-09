"use client";

/**
 * Growth (SEO/annonser/funnel) + autonomy (dashboard/automation).
 * `growthPanelEnabled` matcher tidligere semantikk: samme som innhold-fane med blokker.
 * Transport: `contentWorkspace.aiRequests.ts`.
 */

import { useCallback, useEffect, useState } from "react";
import type { DecisionResult } from "@/lib/ai/decisionEngine";
import type {
  GrowthFunnelStep,
  GrowthSeoKeyword,
  GrowthSeoOpportunity,
} from "./EditorGrowthAiPanel";
import type {
  DashboardDecisionPayload,
  DashboardInsightsPayload,
  DashboardMetricsPayload,
} from "./EditorAutonomyPanel";
import type { Block } from "./editorBlockTypes";
import { getBlockEntryFlatForRender } from "@/lib/cms/blocks/blockEntryContract";
import { fetchPublicAiGet, fetchPublicAiPostJson } from "./contentWorkspace.aiRequests";
import type { UseContentWorkspacePanelRequestsParams } from "./contentWorkspace.panelAi.types";

export type UseContentWorkspaceGrowthAutonomyAiParams = Pick<
  UseContentWorkspacePanelRequestsParams,
  | "effectiveId"
  | "showBlocks"
  | "isContentTab"
  | "displayBlocks"
  | "page"
  | "title"
  | "slug"
>;

export function useContentWorkspaceGrowthAutonomyAi(p: UseContentWorkspaceGrowthAutonomyAiParams) {
  const { effectiveId, showBlocks, isContentTab, displayBlocks, page, title, slug } = p;

  const growthPanelEnabled = Boolean(showBlocks && isContentTab && effectiveId);

  const [growthProductInput, setGrowthProductInput] = useState("");
  const [growthAudienceInput, setGrowthAudienceInput] = useState("");
  const [growthSeoOpportunities, setGrowthSeoOpportunities] = useState<GrowthSeoOpportunity[]>([]);
  const [growthSeoKeywords, setGrowthSeoKeywords] = useState<GrowthSeoKeyword[]>([]);
  const [growthContentIdeas, setGrowthContentIdeas] = useState<string[]>([]);
  const [growthAdHeadlines, setGrowthAdHeadlines] = useState<string[]>([]);
  const [growthAdDescriptions, setGrowthAdDescriptions] = useState<string[]>([]);
  const [growthFunnelSteps, setGrowthFunnelSteps] = useState<GrowthFunnelStep[]>([]);
  const [growthFunnelImprovements, setGrowthFunnelImprovements] = useState<string[]>([]);
  const [growthBusy, setGrowthBusy] = useState(false);
  const [growthError, setGrowthError] = useState<string | null>(null);

  useEffect(() => {
    const t = (page?.title ?? title).trim();
    setGrowthProductInput(t || "Lunchportalen");
    setGrowthAudienceInput("");
  }, [effectiveId, page?.title, title]);

  const onGrowthClearPreview = useCallback(() => {
    setGrowthSeoOpportunities([]);
    setGrowthSeoKeywords([]);
    setGrowthContentIdeas([]);
    setGrowthAdHeadlines([]);
    setGrowthAdDescriptions([]);
    setGrowthFunnelSteps([]);
    setGrowthFunnelImprovements([]);
    setGrowthError(null);
  }, []);

  const onGrowthRunSeo = useCallback(async () => {
    if (!growthPanelEnabled) return;
    setGrowthBusy(true);
    setGrowthError(null);
    const pathSlug = (slug ?? page?.slug ?? "").toString().trim();
    const path = pathSlug ? `/${pathSlug.replace(/^\/+/, "")}` : "/";
    const siteData = {
      domain: "lunchportalen.no",
      locale: "nb",
      pages: [{ path, title: (page?.title ?? title).trim() || undefined }],
      existingKeywords: [] as string[],
    };
    try {
      const { ok: httpOk, json } = await fetchPublicAiPostJson("/api/ai/growth/seo", { siteData });
      const body = json as {
        ok?: boolean;
        data?: {
          opportunities?: GrowthSeoOpportunity[];
          keywords?: GrowthSeoKeyword[];
          contentIdeas?: string[];
        };
        error?: string;
      };
      if (!httpOk || body.ok === false) {
        setGrowthError(typeof body.error === "string" ? body.error : "SEO-motor feilet");
        return;
      }
      setGrowthSeoOpportunities(Array.isArray(body.data?.opportunities) ? body.data!.opportunities! : []);
      setGrowthSeoKeywords(Array.isArray(body.data?.keywords) ? body.data!.keywords! : []);
      setGrowthContentIdeas(Array.isArray(body.data?.contentIdeas) ? body.data!.contentIdeas! : []);
    } catch {
      setGrowthError("Nettverksfeil ved SEO");
    } finally {
      setGrowthBusy(false);
    }
  }, [growthPanelEnabled, slug, page?.slug, page?.title, title]);

  const onGrowthRunAds = useCallback(async () => {
    if (!growthPanelEnabled) return;
    const product = growthProductInput.trim();
    if (!product) return;
    setGrowthBusy(true);
    setGrowthError(null);
    try {
      const { ok: httpOk, json } = await fetchPublicAiPostJson("/api/ai/growth/ads", {
        product,
        audience: growthAudienceInput.trim() || undefined,
        locale: "nb",
      });
      const body = json as {
        ok?: boolean;
        data?: { headlines?: string[]; descriptions?: string[] };
        error?: string;
      };
      if (!httpOk || body.ok === false) {
        setGrowthError(typeof body.error === "string" ? body.error : "Annonsegenerator feilet");
        return;
      }
      setGrowthAdHeadlines(Array.isArray(body.data?.headlines) ? body.data!.headlines!.map(String) : []);
      setGrowthAdDescriptions(Array.isArray(body.data?.descriptions) ? body.data!.descriptions!.map(String) : []);
    } catch {
      setGrowthError("Nettverksfeil ved annonser");
    } finally {
      setGrowthBusy(false);
    }
  }, [growthPanelEnabled, growthProductInput, growthAudienceInput]);

  const onGrowthRunFunnel = useCallback(async () => {
    if (!growthPanelEnabled) return;
    setGrowthBusy(true);
    setGrowthError(null);
    const bl = displayBlocks as Block[];
    const ctaB = bl.find((b) => b.type === "cta");
    const heroB = bl.find((b) => b.type === "hero");
    const primaryCta =
      ctaB?.type === "cta" ?
        String(getBlockEntryFlatForRender(ctaB).buttonLabel ?? "").trim() || undefined
      : heroB?.type === "hero" ?
        String(getBlockEntryFlatForRender(heroB).ctaLabel ?? "").trim() || undefined
      : undefined;
    const content = {
      title: (page?.title ?? title).trim(),
      primaryCta,
      blockTypes: bl.map((b) => b.type),
      hasHero: bl.some((b) => b.type === "hero"),
      hasLeadForm: false,
    };
    try {
      const { ok: httpOk, json } = await fetchPublicAiPostJson("/api/ai/growth/funnel", {
        content,
        analytics: {},
      });
      const body = json as {
        ok?: boolean;
        data?: { steps?: GrowthFunnelStep[]; improvements?: string[] };
        error?: string;
      };
      if (!httpOk || body.ok === false) {
        setGrowthError(typeof body.error === "string" ? body.error : "Funnel-motor feilet");
        return;
      }
      setGrowthFunnelSteps(Array.isArray(body.data?.steps) ? body.data!.steps! : []);
      setGrowthFunnelImprovements(
        Array.isArray(body.data?.improvements) ? body.data!.improvements!.map(String) : [],
      );
    } catch {
      setGrowthError("Nettverksfeil ved funnel");
    } finally {
      setGrowthBusy(false);
    }
  }, [growthPanelEnabled, displayBlocks, page?.title, title]);

  const autonomyPanelEnabled = growthPanelEnabled;
  const [autonomyBusy, setAutonomyBusy] = useState(false);
  const [autonomyError, setAutonomyError] = useState<string | null>(null);
  const [autonomyMetrics, setAutonomyMetrics] = useState<DashboardMetricsPayload | null>(null);
  const [autonomyInsights, setAutonomyInsights] = useState<DashboardInsightsPayload | null>(null);
  const [autonomyDecisionRow, setAutonomyDecisionRow] = useState<DashboardDecisionPayload | null>(null);
  const [autonomyAutomationText, setAutonomyAutomationText] = useState<string | null>(null);

  const onAutonomyRefreshDashboard = useCallback(async () => {
    if (!autonomyPanelEnabled) return;
    setAutonomyBusy(true);
    setAutonomyError(null);
    try {
      const { ok: httpOk, json } = await fetchPublicAiGet("/api/ai/dashboard");
      const body = json as {
        ok?: boolean;
        data?: {
          metrics?: DashboardMetricsPayload;
          insights?: DashboardInsightsPayload;
          decisions?: DashboardDecisionPayload[];
        };
        error?: string;
      };
      if (!httpOk || body.ok === false) {
        setAutonomyError(typeof body.error === "string" ? body.error : "Dashboard feilet");
        return;
      }
      setAutonomyMetrics(body.data?.metrics ?? null);
      setAutonomyInsights(body.data?.insights ?? null);
      const row =
        Array.isArray(body.data?.decisions) && body.data!.decisions!.length > 0 ? body.data!.decisions![0]! : null;
      setAutonomyDecisionRow(row);
      setAutonomyAutomationText(null);
    } catch {
      setAutonomyError("Nettverksfeil ved dashboard");
    } finally {
      setAutonomyBusy(false);
    }
  }, [autonomyPanelEnabled]);

  const onAutonomyPreviewAutomation = useCallback(
    async (decision: DecisionResult) => {
      if (!autonomyPanelEnabled) return;
      setAutonomyBusy(true);
      setAutonomyError(null);
      try {
        const { ok: httpOk, json } = await fetchPublicAiPostJson("/api/ai/automation", {
          decision,
          mode: "preview",
        });
        const body = json as {
          ok?: boolean;
          data?: { result?: { actionPreview?: string; explain?: string; policy?: { explain?: string } } };
          error?: string;
        };
        if (!httpOk || body.ok === false) {
          setAutonomyError(typeof body.error === "string" ? body.error : "Automatisering feilet");
          return;
        }
        const r = body.data?.result;
        setAutonomyAutomationText(
          [r?.actionPreview, r?.explain, r?.policy?.explain ? `Policy: ${r.policy.explain}` : ""]
            .filter(Boolean)
            .join("\n\n"),
        );
      } catch {
        setAutonomyError("Nettverksfeil ved forhåndsvisning");
      } finally {
        setAutonomyBusy(false);
      }
    },
    [autonomyPanelEnabled],
  );

  const onAutonomyApproveExecute = useCallback(
    async (decision: DecisionResult) => {
      if (!autonomyPanelEnabled) return;
      setAutonomyBusy(true);
      setAutonomyError(null);
      try {
        const { ok: httpOk, json } = await fetchPublicAiPostJson("/api/ai/automation", {
          decision,
          mode: "execute",
          approved: true,
        });
        const body = json as {
          ok?: boolean;
          data?: {
            result?: { executed?: boolean; actionPreview?: string; explain?: string; policy?: { explain?: string } };
          };
          error?: string;
        };
        if (!httpOk || body.ok === false) {
          setAutonomyError(typeof body.error === "string" ? body.error : "Utførelse feilet");
          return;
        }
        const r = body.data?.result;
        setAutonomyAutomationText(
          [
            r?.executed ? "[Utført: trygg akseptering]" : "[Ikke utført]",
            r?.actionPreview,
            r?.explain,
            r?.policy?.explain ? `Policy: ${r.policy.explain}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        );
      } catch {
        setAutonomyError("Nettverksfeil ved utførelse");
      } finally {
        setAutonomyBusy(false);
      }
    },
    [autonomyPanelEnabled],
  );

  useEffect(() => {
    setGrowthSeoOpportunities([]);
    setGrowthSeoKeywords([]);
    setGrowthContentIdeas([]);
    setGrowthAdHeadlines([]);
    setGrowthAdDescriptions([]);
    setGrowthFunnelSteps([]);
    setGrowthFunnelImprovements([]);
    setGrowthBusy(false);
    setGrowthError(null);
    setAutonomyBusy(false);
    setAutonomyError(null);
    setAutonomyMetrics(null);
    setAutonomyInsights(null);
    setAutonomyDecisionRow(null);
    setAutonomyAutomationText(null);
  }, [effectiveId]);

  return {
    growthPanelEnabled,
    growthProductInput,
    setGrowthProductInput,
    growthAudienceInput,
    setGrowthAudienceInput,
    growthSeoOpportunities,
    growthSeoKeywords,
    growthContentIdeas,
    growthAdHeadlines,
    growthAdDescriptions,
    growthFunnelSteps,
    growthFunnelImprovements,
    growthBusy,
    growthError,
    onGrowthClearPreview,
    onGrowthRunSeo,
    onGrowthRunAds,
    onGrowthRunFunnel,
    autonomyPanelEnabled,
    autonomyBusy,
    autonomyError,
    autonomyMetrics,
    autonomyInsights,
    autonomyDecisionRow,
    autonomyAutomationText,
    onAutonomyRefreshDashboard,
    onAutonomyPreviewAutomation,
    onAutonomyApproveExecute,
  };
}

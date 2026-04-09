/**
 * Strict payload schemas per `payload.kind` — no top-level unknown keys on these objects.
 * Nested blobs (metrics, patches) use explicit `z.any()` only where the product stores arbitrary JSON.
 */

import { z } from "zod";

const GtmInteractionSchema = z
  .object({
    id: z.string(),
    at: z.string(),
    channel: z.enum(["email", "linkedin", "manual_note", "inbound_form"]),
    summary: z.string(),
    replyKind: z.enum(["interest", "rejection", "objection", "neutral"]).optional(),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  })
  .strict();

/** Matches {@link GtmLead} — used by `gtm_outcome` ingestion. */
export const GtmLeadPayloadSchema = z
  .object({
    id: z.string(),
    company: z
      .object({
        name: z.string(),
        employeeCount: z.number().optional(),
        industry: z.string().optional(),
      })
      .strict(),
    contact: z
      .object({
        name: z.string().optional(),
        email: z.string().optional(),
        linkedinUrl: z.string().optional(),
        role: z.string().optional(),
      })
      .strict(),
    source: z.enum(["manual", "scraped_controlled", "website_inbound"]),
    score: z.number(),
    status: z.enum(["new", "contacted", "interested", "closed"]),
    campaignId: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    interactions: z.array(GtmInteractionSchema),
  })
  .strict();

export const GtmReplyClassificationSchema = z
  .object({
    kind: z.enum(["interest", "rejection", "objection", "neutral"]),
    confidence: z.number(),
    objectionId: z.literal("has_canteen").optional(),
    notes: z.string().optional(),
  })
  .strict();

/** Stored GTM learning row (central intelligence). */
export const GtmOutcomePayloadSchema = z
  .object({
    kind: z.literal("gtm_outcome"),
    lead: GtmLeadPayloadSchema,
    templateKey: z.string().min(1),
    channel: z.enum(["email", "linkedin"]),
    classification: GtmReplyClassificationSchema,
    offerKey: z.string().min(1).optional(),
  })
  .strict();

/** Editor outreach log (no auto-send). */
export const GtmOutreachSentPayloadSchema = z
  .object({
    kind: z.literal("outreach_sent"),
    channel: z.enum(["email", "linkedin"]),
    leadId: z.string().min(1),
    templateKey: z.string().min(1),
    campaignId: z.string().min(1),
  })
  .strict();

export const GtmConversionIntelPayloadSchema = z
  .object({
    kind: z.literal("gtm_conversion"),
    conversionKind: z.enum(["meeting_booked", "deal_closed"]),
    leadId: z.string().min(1),
    campaignId: z.string().min(1),
    companyName: z.string(),
    valueNok: z.number().optional(),
  })
  .strict();

const DesignMetricsPayloadSchema = z
  .object({
    action: z.enum(["analyze", "apply", "revert", "auto_apply"]),
    timestamp: z.string(),
    suggestionKeys: z.array(z.string()),
    issueCodes: z.array(z.string()).optional(),
    beforeDesignSettings: z.record(z.string(), z.any()),
    afterDesignSettings: z.record(z.string(), z.any()).optional(),
    appliedPatch: z.any().optional(),
    autoApply: z.boolean().optional(),
    policy: z
      .object({
        maxChanges: z.number(),
        rapidToggleOk: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const DesignOptimizerApplyPayloadSchema = z
  .object({
    kind: z.literal("design_optimizer_apply"),
    metrics: DesignMetricsPayloadSchema,
    pageId: z.string().nullable(),
    action: z.enum(["publish", "save"]),
    appliedKeys: z.array(z.string()),
  })
  .strict();

/** Revenue insights snapshot from {@link app/api/backoffice/revenue/insights/route.ts}. */
export const RevenueInsightsPayloadSchema = z
  .object({
    kind: z.literal("revenue_insights"),
    pageId: z.string().min(1),
    sampleOk: z.boolean(),
    pageCtr: z.number().nullable(),
    topWeakIssues: z.array(z.string()),
    ctaFocus: z.string().nullable(),
    strongestCtaBlockId: z.string().nullable(),
  })
  .strict();

/** Canonical revenue attribution event (forward-compatible; strict shape). */
export const RevenueEventPayloadSchema = z
  .object({
    kind: z.literal("revenue_event"),
    blockId: z.string().optional(),
    revenue: z.number(),
  })
  .strict();

const DetectedPatternRowSchema = z
  .object({
    type: z.enum(["cta", "spacing", "channel", "industry"]),
    value: z.string(),
    confidence: z.number(),
    evidence: z.array(z.string()),
  })
  .strict();

export const PatternScalePayloadSchema = z
  .object({
    kind: z.literal("pattern_scale"),
    phase: z.literal("plan"),
    mode: z.enum(["suggest", "auto", "assisted"]),
    logRid: z.string().min(1),
    patterns: z.array(DetectedPatternRowSchema),
    proposedActionIds: z.array(z.string()),
    selectedActionIds: z.array(z.string()),
    cooldown: z
      .object({
        ok: z.boolean(),
        reason: z.string(),
      })
      .strict(),
    autoSafePatchCount: z.number(),
    negativeImpactObserved: z.boolean(),
  })
  .strict();

export const LearningPairPayloadSchema = z
  .object({
    kind: z.literal("learning_pair"),
    change: z.string().min(1),
    result: z.string().min(1),
    explain: z.string().optional(),
  })
  .strict();

const ScaleActionInnerSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("design"),
      patch: z.any(),
    })
    .strict(),
  z
    .object({
      type: z.literal("preferences"),
      targets: z.any(),
    })
    .strict(),
]);

export const ScaleActionPayloadSchema = z
  .object({
    kind: z.literal("scale_action"),
    action: ScaleActionInnerSchema,
    before: z.record(z.string(), z.any()),
    after: z.record(z.string(), z.any()),
  })
  .strict();

export const ScaleRollbackPayloadSchema = z
  .object({
    kind: z.literal("scale_rollback"),
    scope: z.string().min(1),
    restored: z.any(),
  })
  .strict();

export const ScaleIgnorePayloadSchema = z
  .object({
    kind: z.literal("scale_ignore"),
    ids: z.array(z.string()),
  })
  .strict();

export const ExperimentCompletedPayloadSchema = z
  .object({
    kind: z.literal("experiment_completed"),
    experimentId: z.string().min(1),
    recordCount: z.number(),
    pageId: z.string().nullable(),
  })
  .strict();

/** Legacy CMS editor analytics bucket — passthrough body under `kind` (read path may still surface old rows). */
export const EditorMetricPayloadSchema = z
  .object({
    kind: z.literal("editor_metric"),
  })
  .passthrough();

/** Company control-tower policy audit (strict allowlist + mode + risk). */
export const PolicyDecisionPayloadSchema = z
  .object({
    kind: z.literal("policy_decision"),
    decisionId: z.string().min(1),
    allowedAction: z.enum([
      "design.update",
      "design.scale",
      "revenue.optimize",
      "gtm.suggest",
      "content.suggest",
      "none",
    ]),
    allowed: z.boolean(),
    reason: z.string().min(1),
    riskLevel: z.enum(["low", "medium", "high"]),
    mode: z.enum(["manual", "assisted", "auto"]),
    override: z.boolean().optional(),
  })
  .strict();

export const INTELLIGENCE_PAYLOAD_KINDS = [
  "gtm_outcome",
  "outreach_sent",
  "gtm_conversion",
  "design_optimizer_apply",
  "revenue_insights",
  "revenue_event",
  "pattern_scale",
  "learning_pair",
  "scale_action",
  "scale_rollback",
  "scale_ignore",
  "experiment_completed",
  "editor_metric",
  "policy_decision",
] as const;

export type IntelligencePayloadKind = (typeof INTELLIGENCE_PAYLOAD_KINDS)[number];

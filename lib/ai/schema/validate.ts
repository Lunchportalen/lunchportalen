/**
 * Strict validation for intelligence ingestion — base envelope + discriminated payload.kind.
 */

import { z } from "zod";

import type { IntelligenceEvent, LogEventInput } from "../intelligence/types";
import { IntelligenceEventSchema, LogEventInputSchema, type IntelligenceDomainType } from "./events";
import {
  IntelligenceSchemaValidationError,
  logIntelligenceValidationFailure,
} from "./errors";
import {
  DesignOptimizerApplyPayloadSchema,
  EditorMetricPayloadSchema,
  ExperimentCompletedPayloadSchema,
  GtmConversionIntelPayloadSchema,
  GtmOutcomePayloadSchema,
  GtmOutreachSentPayloadSchema,
  LearningPairPayloadSchema,
  PatternScalePayloadSchema,
  PolicyDecisionPayloadSchema,
  RevenueEventPayloadSchema,
  RevenueInsightsPayloadSchema,
  ScaleActionPayloadSchema,
  ScaleIgnorePayloadSchema,
  ScaleRollbackPayloadSchema,
} from "./payloads";

const ALLOWED_KIND_BY_DOMAIN: Record<IntelligenceDomainType, ReadonlySet<string>> = {
  gtm: new Set(["gtm_outcome", "outreach_sent"]),
  conversion: new Set(["gtm_conversion"]),
  design_change: new Set(["design_optimizer_apply"]),
  analytics: new Set([
    "revenue_insights",
    "revenue_event",
    "pattern_scale",
    "learning_pair",
    "scale_action",
    "scale_rollback",
    "scale_ignore",
    "editor_metric",
    "policy_decision",
  ]),
  experiment: new Set(["experiment_completed"]),
};

function zodIssueStrings(err: z.ZodError): string[] {
  return err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function throwValidation(
  message: string,
  ctx: {
    source?: string;
    timestamp?: number;
    domainType?: string;
    payloadKind?: string;
    zodIssues?: string[];
  },
): never {
  logIntelligenceValidationFailure({
    reason: message,
    source: ctx.source,
    timestamp: ctx.timestamp,
    domainType: ctx.domainType,
    payloadKind: ctx.payloadKind,
    zodIssues: ctx.zodIssues,
  });
  throw new IntelligenceSchemaValidationError(message, ctx);
}

function assertKindAllowedForDomain(domain: IntelligenceDomainType, kind: string, source: string): void {
  const allowed = ALLOWED_KIND_BY_DOMAIN[domain];
  if (!allowed.has(kind)) {
    throwValidation(`Payload kind "${kind}" is not allowed for intelligence type "${domain}"`, {
      source,
      domainType: domain,
      payloadKind: kind,
    });
  }
}

function parseStrictPayload(
  domain: IntelligenceDomainType,
  kind: string,
  payload: Record<string, unknown>,
  meta: { source: string; timestamp?: number },
): Record<string, unknown> {
  assertKindAllowedForDomain(domain, kind, meta.source);

  try {
    switch (kind) {
      case "gtm_outcome":
        return GtmOutcomePayloadSchema.parse(payload) as Record<string, unknown>;
      case "outreach_sent":
        return GtmOutreachSentPayloadSchema.parse(payload) as Record<string, unknown>;
      case "gtm_conversion":
        return GtmConversionIntelPayloadSchema.parse(payload) as Record<string, unknown>;
      case "design_optimizer_apply":
        return DesignOptimizerApplyPayloadSchema.parse(payload) as Record<string, unknown>;
      case "revenue_insights":
        return RevenueInsightsPayloadSchema.parse(payload) as Record<string, unknown>;
      case "revenue_event":
        return RevenueEventPayloadSchema.parse(payload) as Record<string, unknown>;
      case "pattern_scale":
        return PatternScalePayloadSchema.parse(payload) as Record<string, unknown>;
      case "learning_pair":
        return LearningPairPayloadSchema.parse(payload) as Record<string, unknown>;
      case "scale_action":
        return ScaleActionPayloadSchema.parse(payload) as Record<string, unknown>;
      case "scale_rollback":
        return ScaleRollbackPayloadSchema.parse(payload) as Record<string, unknown>;
      case "scale_ignore":
        return ScaleIgnorePayloadSchema.parse(payload) as Record<string, unknown>;
      case "experiment_completed":
        return ExperimentCompletedPayloadSchema.parse(payload) as Record<string, unknown>;
      case "editor_metric":
        return EditorMetricPayloadSchema.parse(payload) as Record<string, unknown>;
      case "policy_decision":
        return PolicyDecisionPayloadSchema.parse(payload) as Record<string, unknown>;
      default:
        throwValidation(`Unknown payload kind: ${kind}`, {
          source: meta.source,
          timestamp: meta.timestamp,
          domainType: domain,
          payloadKind: kind,
        });
    }
  } catch (e) {
    if (e instanceof IntelligenceSchemaValidationError) throw e;
    if (e instanceof z.ZodError) {
      throwValidation("Invalid intelligence payload shape", {
        source: meta.source,
        timestamp: meta.timestamp,
        domainType: domain,
        payloadKind: kind,
        zodIssues: zodIssueStrings(e),
      });
    }
    throw e;
  }
}

/**
 * Validates {@link LogEventInput} before persistence. Throws {@link IntelligenceSchemaValidationError} when invalid.
 */
export function validateEvent(input: LogEventInput): LogEventInput {
  const base = LogEventInputSchema.safeParse(input);
  if (!base.success) {
    throwValidation("Invalid intelligence log envelope", {
      source: typeof input?.source === "string" ? input.source : undefined,
      zodIssues: zodIssueStrings(base.error),
    });
  }

  const row = base.data;
  const kindRaw = row.payload.kind;
  if (typeof kindRaw !== "string" || !kindRaw.trim()) {
    throwValidation("Intelligence payload.kind is required", {
      source: row.source,
      domainType: row.type,
    });
  }
  const kind = kindRaw.trim();

  const narrowed = parseStrictPayload(row.type, kind, row.payload, {
    source: row.source,
  });

  const out: LogEventInput = {
    type: row.type,
    source: row.source,
    payload: narrowed,
    page_id: row.page_id,
    company_id: row.company_id,
    source_rid: row.source_rid,
  };
  return out;
}

/**
 * Validates a full row (e.g. tests, external rehydration). Throws {@link IntelligenceSchemaValidationError} when invalid.
 */
export function validatePersistedIntelligenceEvent(input: unknown): IntelligenceEvent {
  const base = IntelligenceEventSchema.safeParse(input);
  if (!base.success) {
    throwValidation("Invalid persisted intelligence event envelope", {
      zodIssues: zodIssueStrings(base.error),
    });
  }

  const row = base.data;
  const kindRaw = row.payload.kind;
  if (typeof kindRaw !== "string" || !kindRaw.trim()) {
    throwValidation("Intelligence payload.kind is required", {
      source: row.source,
      timestamp: row.timestamp,
      domainType: row.type,
    });
  }
  const kind = kindRaw.trim();

  const narrowed = parseStrictPayload(row.type, kind, row.payload, {
    source: row.source,
    timestamp: row.timestamp,
  });

  const out: IntelligenceEvent = {
    id: row.id,
    type: row.type,
    source: row.source,
    timestamp: row.timestamp,
    payload: narrowed,
  };
  return out;
}

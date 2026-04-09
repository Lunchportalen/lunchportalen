/**
 * Intelligence schema validation — typed errors + structured ops logging (no silent failures).
 */

import { opsLog } from "@/lib/ops/log";

export class IntelligenceSchemaValidationError extends Error {
  override readonly name = "IntelligenceSchemaValidationError";

  constructor(
    message: string,
    readonly ctx: {
      source?: string;
      timestamp?: number;
      domainType?: string;
      payloadKind?: string;
      zodIssues?: string[];
    } = {},
  ) {
    super(message);
  }
}

export class IntelligenceStoreFetchError extends Error {
  override readonly name = "IntelligenceStoreFetchError";

  constructor(
    message: string,
    readonly causeDetail?: string,
  ) {
    super(message);
  }
}

export function logIntelligenceValidationFailure(input: {
  reason: string;
  source?: string;
  timestamp?: number;
  domainType?: string;
  payloadKind?: string;
  zodIssues?: string[];
}): void {
  opsLog("ai_intelligence.schema_validation_failed", {
    reason: input.reason,
    source: input.source ?? null,
    timestamp: input.timestamp ?? null,
    domainType: input.domainType ?? null,
    payloadKind: input.payloadKind ?? null,
    zodIssues: input.zodIssues?.length ? input.zodIssues.slice(0, 24) : null,
  });
}

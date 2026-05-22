import "server-only";

import type { SeverityLevel } from "@sentry/core";
import * as Sentry from "@sentry/nextjs";

import { scrubLogContext, shouldEnableSentry } from "@/lib/sentry/scrubEvent";

export type SentryCaptureContext = Record<string, unknown>;

function withScope(context: SentryCaptureContext | undefined, fn: () => void): void {
  if (!shouldEnableSentry()) return;

  Sentry.withScope((scope) => {
    const safe = scrubLogContext(context);
    if (safe) {
      for (const [key, value] of Object.entries(safe)) {
        scope.setTag(key, String(value));
      }
      scope.setContext("lp", safe);
    }
    fn();
  });
}

export function captureServerException(error: unknown, context?: SentryCaptureContext): void {
  withScope(context, () => {
    if (error instanceof Error) {
      Sentry.captureException(error);
      return;
    }
    Sentry.captureException(new Error(String(error ?? "unknown_error")));
  });
}

export function captureServerMessage(
  message: string,
  level: SeverityLevel,
  context?: SentryCaptureContext,
): void {
  withScope(context, () => {
    Sentry.captureMessage(message, level);
  });
}

export function reportCronFailure(
  cronPath: string,
  rid: string,
  error: unknown,
  meta?: SentryCaptureContext,
): void {
  captureServerException(error, {
    cron: cronPath,
    rid,
    ...scrubLogContext(meta),
  });
}

export function reportOutboxPermanentFailure(meta: {
  outbox_id: string;
  event_key?: string;
  attempts?: number;
  status?: string;
  error?: string;
}): void {
  captureServerMessage("outbox FAILED_PERMANENT", "error", scrubLogContext(meta));
}

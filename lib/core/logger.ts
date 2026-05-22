import * as Sentry from "@sentry/nextjs";

import { scrubLogContext, shouldEnableSentry } from "@/lib/sentry/scrubEvent";

type LogContext = Record<string, unknown>;

function breadcrumb(message: string, level: Sentry.SeverityLevel, context?: LogContext): void {
  if (!shouldEnableSentry()) return;
  Sentry.addBreadcrumb({
    message,
    level,
    data: scrubLogContext(context),
  });
}

function withScope(context: LogContext | undefined, fn: () => void): void {
  if (!shouldEnableSentry()) {
    fn();
    return;
  }
  Sentry.withScope((scope) => {
    const safe = scrubLogContext(context);
    if (safe) scope.setContext("lp", safe);
    fn();
  });
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error ?? "unknown_error"));
}

export const log = {
  info(message: string, context?: LogContext): void {
    const safe = scrubLogContext(context);
    if (safe) console.log(message, safe);
    else console.log(message);
    breadcrumb(message, "info", context);
  },

  warn(message: string, context?: LogContext): void {
    const safe = scrubLogContext(context);
    if (safe) console.warn(message, safe);
    else console.warn(message);
    breadcrumb(message, "warning", context);
    withScope(context, () => {
      Sentry.captureMessage(message, "warning");
    });
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    const safe = scrubLogContext(context);
    const err = error !== undefined ? normalizeError(error) : new Error(message);
    if (safe) console.error(message, err, safe);
    else console.error(message, err);
    withScope(context, () => {
      Sentry.captureException(err, { extra: { message, ...safe } });
    });
  },

  fatal(message: string, error?: unknown, context?: LogContext): void {
    const safe = scrubLogContext(context);
    const err = error !== undefined ? normalizeError(error) : new Error(message);
    if (safe) console.error("[FATAL]", message, err, safe);
    else console.error("[FATAL]", message, err);
    withScope(context, () => {
      Sentry.captureException(err, { level: "fatal", extra: { message, ...safe } });
    });
  },
};

/** @deprecated Prefer `log.error(source, error, { source })`. */
export function logError(source: string, error: unknown): void {
  log.error(source, error, { source });
}

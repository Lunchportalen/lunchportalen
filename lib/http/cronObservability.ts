import { reportCronFailure } from "@/lib/sentry/capture";

/**
 * Report a handled cron failure to Sentry (no payload / PII in meta).
 * Call from cron route catch blocks before returning jsonErr.
 */
export function captureCronHandlerError(
  cronPath: string,
  rid: string,
  error: unknown,
  meta?: Record<string, unknown>,
): void {
  reportCronFailure(cronPath, rid, error, meta);
}

import { resolveSentryDsn, resolveSentryEnvironment, shouldEnableSentry } from "@/lib/sentry/scrubEvent";

/** Temporary runtime probe — remove after Sentry capture is verified. */
export function logSentryDiagnostics(scope: string): void {
  const dsn = resolveSentryDsn();
  let dsnHost: string | null = null;
  if (dsn) {
    try {
      dsnHost = new URL(dsn).host;
    } catch {
      dsnHost = "invalid-url";
    }
  }

  console.log("[sentry-diag]", {
    scope,
    enabled: shouldEnableSentry(),
    hasDsn: Boolean(String(process.env.SENTRY_DSN ?? "").trim()),
    hasPublicDsn: Boolean(String(process.env.NEXT_PUBLIC_SENTRY_DSN ?? "").trim()),
    dsnHost,
    sentryEnvironment: resolveSentryEnvironment(),
    vercelEnv: process.env.VERCEL_ENV ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
  });
}

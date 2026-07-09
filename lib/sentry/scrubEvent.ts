const SENSITIVE_EXTRA_KEYS = new Set([
  "password",
  "token",
  "secret",
  "api_key",
  "orgnr",
  "invoice_amount",
  "customer_email",
  "email",
  "phone",
  "authorization",
  "cookie",
]);

const IGNORE_ERROR_PATTERNS = [
  /Failed to fetch/i,
  /NEXT_REDIRECT/i,
  /AbortError/i,
];

/** Safe operational context keys (UUIDs, route names — not PII). */
export function scrubLogContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    const k = key.toLowerCase();
    if (SENSITIVE_EXTRA_KEYS.has(k)) continue;
    if (k.includes("email") || k.includes("phone") || k.includes("password") || k.includes("token")) continue;
    out[key] = value;
  }
  return out;
}

export function resolveSentryEnvironment(): string {
  const vercelEnv = String(process.env.VERCEL_ENV ?? "").trim();
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "staging";
  if (vercelEnv === "development") return "development";
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function resolveSentryDsn(): string | undefined {
  const dsn = String(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "").trim();
  return dsn || undefined;
}

export function shouldEnableSentry(): boolean {
  return Boolean(resolveSentryDsn());
}

type SentryEventLike = {
  request?: { cookies?: unknown; headers?: Record<string, unknown> };
  user?: { email?: unknown; ip_address?: unknown; username?: unknown };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  message?: unknown;
  exception?: { values?: Array<{ value?: unknown }> };
};

function scrubEventPayload(event: SentryEventLike): void {
  if (event.request) {
    delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
      delete event.request.headers.Authorization;
      delete event.request.headers.Cookie;
    }
  }

  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }

  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      if (SENSITIVE_EXTRA_KEYS.has(key.toLowerCase())) {
        delete event.extra[key];
      }
    }
  }

  if (event.contexts) {
    for (const ctxKey of Object.keys(event.contexts)) {
      const ctx = event.contexts[ctxKey];
      if (ctx && typeof ctx === "object") {
        for (const key of Object.keys(ctx as Record<string, unknown>)) {
          if (SENSITIVE_EXTRA_KEYS.has(key.toLowerCase())) {
            delete (ctx as Record<string, unknown>)[key];
          }
        }
      }
    }
  }
}

export function scrubSentryEvent<T extends SentryEventLike>(event: T): T | null {
  const message = String(event.message ?? event.exception?.values?.[0]?.value ?? "");
  if (message && IGNORE_ERROR_PATTERNS.some((re) => re.test(message))) {
    return null;
  }

  scrubEventPayload(event);
  return event;
}

// Keep this structural: Sentry types can be duplicated by package manager installs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSentryInitOptions(): any {
  const environment = resolveSentryEnvironment();
  const enabled = shouldEnableSentry();
  const isProduction = environment === "production";

  const options = {
    dsn: resolveSentryDsn(),
    enabled,
    environment,
    sendDefaultPii: false,
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    beforeSend(event: SentryEventLike) {
      return scrubSentryEvent(event);
    },
    ignoreErrors: IGNORE_ERROR_PATTERNS.map(String),
  };

  return options;
}

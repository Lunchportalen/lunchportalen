import { describe, expect, it } from "vitest";

import { resolveSentryEnvironment, scrubLogContext, scrubSentryEvent } from "@/lib/sentry/scrubEvent";

describe("Sentry PII scrubbing", () => {
  it("strips sensitive keys from log context", () => {
    const out = scrubLogContext({
      company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      provider_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      customer_email: "secret@example.com",
      orgnr: "123456789",
      route: "/api/cron/outbox",
    });

    expect(out).toEqual({
      company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      provider_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      route: "/api/cron/outbox",
    });
  });

  it("scrubs cookies, auth headers, and user email from events", () => {
    const event = scrubSentryEvent({
      message: "test failure",
      request: {
        cookies: { sb: "secret" },
        headers: {
          authorization: "Bearer secret",
          cookie: "a=b",
        },
      },
      user: {
        id: "user-uuid",
        email: "person@example.com",
        ip_address: "127.0.0.1",
      },
      extra: {
        password: "x",
        company_id: "ok-uuid",
      },
    });

    expect(event?.request?.cookies).toBeUndefined();
    expect(event?.request?.headers?.authorization).toBeUndefined();
    expect(event?.user?.email).toBeUndefined();
    expect(event?.user?.ip_address).toBeUndefined();
    expect(event?.user?.id).toBe("user-uuid");
    expect(event?.extra?.password).toBeUndefined();
    expect(event?.extra?.company_id).toBe("ok-uuid");
  });

  it("drops NEXT_REDIRECT noise", () => {
    const dropped = scrubSentryEvent({
      message: "NEXT_REDIRECT",
    });
    expect(dropped).toBeNull();
  });

  it("maps Vercel preview to staging environment", () => {
    const prev = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "preview";
    expect(resolveSentryEnvironment()).toBe("staging");
    process.env.VERCEL_ENV = prev;
  });
});

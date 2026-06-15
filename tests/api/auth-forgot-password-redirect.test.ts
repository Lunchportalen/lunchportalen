// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from "vitest";

const generateLinkMock = vi.hoisted(() => vi.fn());
const sendMailMock = vi.hoisted(() => vi.fn());
const opsLogMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    auth: {
      admin: {
        generateLink: generateLinkMock,
      },
    },
  }),
}));

vi.mock("@/lib/orderBackup/smtp", () => ({
  sendMail: sendMailMock,
}));

vi.mock("@/lib/ops/log", () => ({
  opsLog: opsLogMock,
}));

import { POST } from "@/app/api/auth/forgot-password/route";
import * as recoveryActionLink from "@/lib/auth/recoveryActionLink";

function mkReq(email: string) {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

describe("POST /api/auth/forgot-password redirect URL", () => {
  beforeEach(() => {
    generateLinkMock.mockReset();
    sendMailMock.mockReset();
    opsLogMock.mockReset();

    generateLinkMock.mockResolvedValue({
      data: {
        properties: {
          action_link:
            "https://example.supabase.co/auth/v1/verify?token=abc&type=recovery&redirect_to=https%3A%2F%2Fapp.lunchportalen.no%2Freset-password",
        },
      },
      error: null,
    });
    sendMailMock.mockResolvedValue(undefined);

    vi.unstubAllEnvs();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  });

  test("passes production reset redirectTo to generateLink", async () => {
    const res = await POST(mkReq("post@melhuscatering.no"));
    expect(res.status).toBe(200);

    expect(generateLinkMock).toHaveBeenCalledTimes(1);
    expect(generateLinkMock.mock.calls[0][0]).toMatchObject({
      type: "recovery",
      email: "post@melhuscatering.no",
      options: {
        redirectTo: "https://app.lunchportalen.no/reset-password",
      },
    });
  });

  test("request host app.lunchportalen.no forces production redirect without VERCEL_ENV", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

    const req = new Request("https://app.lunchportalen.no/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "app.lunchportalen.no",
      },
      body: JSON.stringify({ email: "post@melhuscatering.no" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(generateLinkMock.mock.calls.at(-1)?.[0]).toMatchObject({
      options: { redirectTo: "https://app.lunchportalen.no/reset-password" },
    });
  });

  test("uses shared sendMail path and does not log tokenized URL", async () => {
    const actionLink =
      "https://example.supabase.co/auth/v1/verify?token=secret-token&type=recovery&redirect_to=https%3A%2F%2Fapp.lunchportalen.no%2Freset-password";
    generateLinkMock.mockResolvedValueOnce({
      data: { properties: { action_link: actionLink } },
      error: null,
    });

    const res = await POST(mkReq("post@melhuscatering.no"));
    expect(res.status).toBe(200);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0].text).toContain(actionLink);

    for (const call of opsLogMock.mock.calls) {
      const payload = JSON.stringify(call);
      expect(payload).not.toContain("secret-token");
      expect(payload).not.toContain(actionLink);
    }
  });

  test("normalizes Supabase localhost redirect_to in action_link before sendMail", async () => {
    const localhostLink =
      "https://example.supabase.co/auth/v1/verify?token=secret-token&type=recovery&redirect_to=http%3A%2F%2Flocalhost%3A3000";
    generateLinkMock.mockResolvedValueOnce({
      data: { properties: { action_link: localhostLink } },
      error: null,
    });

    const res = await POST(mkReq("post@melhuscatering.no"));
    expect(res.status).toBe(200);

    const mailedText = sendMailMock.mock.calls[0][0].text;
    expect(mailedText).toContain("redirect_to=https%3A%2F%2Fapp.lunchportalen.no%2Freset-password");
    expect(mailedText).not.toContain("localhost");
  });

  test("fail-closed when action_link still has localhost after normalization", async () => {
    const spy = vi
      .spyOn(recoveryActionLink, "normalizeRecoveryActionLink")
      .mockImplementation((link) => link);

    generateLinkMock.mockResolvedValueOnce({
      data: {
        properties: {
          action_link:
            "https://example.supabase.co/auth/v1/verify?token=secret&type=recovery&redirect_to=http%3A%2F%2Flocalhost%3A3000",
        },
      },
      error: null,
    });

    const res = await POST(mkReq("post@melhuscatering.no"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("RECOVERY_REDIRECT_LOCALHOST");
    expect(sendMailMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

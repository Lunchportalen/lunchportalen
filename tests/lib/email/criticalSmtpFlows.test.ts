import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMailMock = vi.hoisted(() => vi.fn());
const createTransportMock = vi.hoisted(() => vi.fn());

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

import { buildCompanyApprovedEmail } from "@/lib/email/templates/companyApproved";
import { buildPasswordResetEmail } from "@/lib/email/passwordResetMail";
import { sendMail } from "@/lib/orderBackup/smtp";

describe("critical SMTP mail bodies", () => {
  beforeEach(() => {
    sendMailMock.mockReset();
    createTransportMock.mockReset();
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    sendMailMock.mockResolvedValue({ messageId: "test-msg-id" });

    vi.stubEnv("LP_SMTP_HOST", "smtp.example.test");
    vi.stubEnv("LP_SMTP_PORT", "587");
    vi.stubEnv("LP_SMTP_USER", "smtp-user");
    vi.stubEnv("LP_SMTP_PASS", "smtp-pass");
    vi.stubEnv("LP_SMTP_SECURE", "false");
  });

  it("password reset: builds Norwegian copy with recovery link", () => {
    const link = "https://app.lunchportalen.no/reset-password?token=abc";
    const { subject, text } = buildPasswordResetEmail(link);

    expect(subject).toBe("Tilbakestill passordet ditt i Lunchportalen");
    expect(text).toContain("Du ba om å tilbakestille passordet ditt");
    expect(text).toContain(link);
    expect(text).toContain("30 minutter");
  });

  it("password reset: sendMail receives exact payload via shared SMTP module", async () => {
    const link = "https://app.lunchportalen.no/reset-password?token=abc";
    const { subject, text } = buildPasswordResetEmail(link);

    await sendMail({
      from: "Lunchportalen <no-reply@lunchportalen.no>",
      to: "admin@firma.no",
      subject,
      text,
    });

    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(createTransportMock.mock.calls[0][0]).toEqual({
      host: "smtp.example.test",
      port: 587,
      secure: false,
      auth: { user: "smtp-user", pass: "smtp-pass" },
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0]).toEqual({
      from: "Lunchportalen <no-reply@lunchportalen.no>",
      to: "admin@firma.no",
      subject: "Tilbakestill passordet ditt i Lunchportalen",
      text,
      html: undefined,
    });
  });

  it("onboarding (company approved): builds activation message with CTA URL", () => {
    const activateUrl = "https://app.lunchportalen.no/registrer-bruker?token=invite-token";
    const { subject, html, text } = buildCompanyApprovedEmail({
      contactName: "Ola Nordmann",
      companyName: "Testfirma AS",
      activateUrl,
    });

    expect(subject).toBe("Velkommen til Lunchportalen – aktiver din konto");
    expect(html).toContain(activateUrl);
    expect(html).toContain("Testfirma AS");
    expect(html).toContain("Ola Nordmann");
    expect(text).toContain(activateUrl);
    expect(text).toContain("7 dager");
  });

  it("onboarding (company approved): outbox-style payload sends via mock transport", async () => {
    const activateUrl = "https://app.lunchportalen.no/registrer-bruker?token=invite-token";
    const { subject, html, text } = buildCompanyApprovedEmail({
      contactName: "Ola Nordmann",
      companyName: "Testfirma AS",
      activateUrl,
    });

    const outboxPayload = {
      from: "Lunchportalen <no-reply@lunchportalen.no>",
      to: "ola@testfirma.no",
      subject,
      bodyText: text,
      bodyHtml: html,
    };

    await sendMail({
      from: outboxPayload.from,
      to: outboxPayload.to,
      subject: outboxPayload.subject,
      text: outboxPayload.bodyText,
      html: outboxPayload.bodyHtml,
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0]).toMatchObject({
      from: outboxPayload.from,
      to: outboxPayload.to,
      subject: outboxPayload.subject,
      text: outboxPayload.bodyText,
      html: outboxPayload.bodyHtml,
    });
    expect(String(sendMailMock.mock.calls[0][0].html)).toContain(activateUrl);
  });
});

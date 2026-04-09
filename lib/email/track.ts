import "server-only";

import { opsLog } from "@/lib/ops/log";

export type EmailSendTrace = {
  type: "email_sent";
  toDomain?: string;
  subject?: string;
  messageId?: string;
  campaignId?: string;
  rid: string;
  timestamp: number;
};

export function trackEmailSend(data: Omit<EmailSendTrace, "type" | "timestamp"> & { type?: "email_sent" }): EmailSendTrace {
  const row: EmailSendTrace = {
    type: "email_sent",
    ...data,
    timestamp: Date.now(),
  };
  opsLog("email_send_trace", row);
  return row;
}

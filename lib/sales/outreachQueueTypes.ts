import type { LinkedInDraft } from "@/lib/sales/linkedin";

export type SalesChannel = "email" | "linkedin";

export type SalesQueueStatus = "draft" | "approved" | "sent" | "failed" | "ready_manual";

export type SalesOutreachQueueItem = {
  id: string;
  dealId: string;
  company: string;
  message: string;
  channel: SalesChannel;
  email: string | null;
  status: SalesQueueStatus;
  approvedAt: number | null;
  sentAt: number | null;
  createdAt: number;
  linkedinDraft?: LinkedInDraft | null;
};

/** Bakoverkompatibel alias. */
export type OutreachQueueItem = SalesOutreachQueueItem;

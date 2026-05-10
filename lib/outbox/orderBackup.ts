// STATUS: KEEP

// lib/outbox/orderBackup.ts
import { opsLog } from "@/lib/ops/log";

type BackupEvent = {
  eventType: "SET_CHOICE" | "BULK_SET" | "CANCEL";
  company_id: string;
  location_id: string;
  user_id: string;
  date?: string; // YYYY-MM-DD
  dates?: string[]; // bulk
  payload: unknown; // hele API-resultatet du vil logge
};

export async function enqueueAndSendOrderBackup(evt: BackupEvent) {
  opsLog("order_backup.legacy_disabled", {
    event_type: evt.eventType,
    company_id: evt.company_id,
    location_id: evt.location_id,
    user_id: evt.user_id,
    date: evt.date ?? null,
    dates_count: Array.isArray(evt.dates) ? evt.dates.length : 0,
    reason: "order_outbox_removed_use_public_outbox",
  });
  return {
    ok: false as const,
    stage: "deprecated",
    error: "order_outbox_removed_use_public_outbox",
  };
}

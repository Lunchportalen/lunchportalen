// lib/orderBackup/format.ts
import type { OrderBackupInput } from "./types";

function safe(v: any) {
  return String(v ?? "").trim();
}

export function buildBackupSubject(input: OrderBackupInput) {
  const t =
    input.eventType === "ORDER_PLACED"
      ? "BESTILT"
      : input.eventType === "ORDER_CANCELLED"
        ? "AVBESTILT"
        : "MENYVALG";
  return `[Lunchportalen] ${t} ${input.date} • ${safe(input.companyId).slice(0, 8)} • rid:${safe(input.rid).slice(0, 8)}`;
}

export function buildBackupText(input: OrderBackupInput) {
  const lines: string[] = [];
  lines.push("Lunchportalen – ordre-backup");
  lines.push("");
  lines.push(`eventType: ${input.eventType}`);
  lines.push(`timestamp: ${input.timestampISO}`);
  lines.push(`rid: ${input.rid}`);
  lines.push(`eventKey: ${input.eventKey}`);
  lines.push("");
  lines.push(`companyId: ${input.companyId}`);
  lines.push(`locationId: ${input.locationId}`);
  lines.push(`userId: ${input.userId}`);
  lines.push(`userEmail: ${input.userEmail ?? ""}`);
  lines.push("");
  lines.push(`date: ${input.date}`);
  lines.push(`status: ${input.status}`);
  if (input.choiceKey) lines.push(`choiceKey: ${input.choiceKey}`);
  if (input.orderId) lines.push(`orderId: ${input.orderId}`);
  lines.push("");
  lines.push("Dette er en driftssikring (backup) og kan ignoreres av kunde.");
  return lines.join("\n");
}

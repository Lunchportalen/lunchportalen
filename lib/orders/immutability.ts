// lib/orders/immutability.ts
import "server-only";

import { cutoffStatusForDate0805 } from "@/lib/date/oslo";

export type ImmutabilityStatus = {
  locked: boolean;
  cutoffTime: "08:05";
  lockCode: "LOCKED_AFTER_0805" | "DATE_LOCKED_PAST" | null;
};

export function immutabilityStatusForDate(dateISO: string): ImmutabilityStatus {
  const cutoff = cutoffStatusForDate0805(dateISO);
  if (cutoff === "TODAY_LOCKED") {
    return { locked: true, cutoffTime: "08:05", lockCode: "LOCKED_AFTER_0805" };
  }
  if (cutoff === "PAST") {
    return { locked: true, cutoffTime: "08:05", lockCode: "DATE_LOCKED_PAST" };
  }
  return { locked: false, cutoffTime: "08:05", lockCode: null };
}

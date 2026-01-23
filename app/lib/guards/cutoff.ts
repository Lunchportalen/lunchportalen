// lib/guards/cutoff.ts

/**
 * =========================================================
 * CUTOFF GUARDS – 08:00 EUROPE/OSLO
 * ---------------------------------------------------------
 * - Brukes kun server-side (API / actions)
 * - Kaster kontrollert Error med code="CUTOFF"
 * - Skal ALDRI brukes i UI direkte
 * =========================================================
 */

import { isAfterCutoff0800, osloTodayISODate } from "@/lib/date/oslo";

type CutoffError = Error & { code?: "CUTOFF" };

/**
 * HARD cutoff basert på "nå"
 * Brukes kun der handling ALLTID gjelder i dag
 */
export function assertBeforeCutoff0800(action: string): void {
  if (isAfterCutoff0800()) {
    const err: CutoffError = new Error(
      `${action} er stengt etter kl. 08:00 (Oslo-tid).`
    );
    err.code = "CUTOFF";
    throw err;
  }
}

/**
 * HARD cutoff per leveringsdato (ANBEFALT)
 * Cutoff gjelder KUN hvis deliveryDate === i dag
 */
export function assertBeforeCutoffForDeliveryDate(
  action: string,
  deliveryDateISO: string
): void {
  const today = osloTodayISODate();

  if (deliveryDateISO === today && isAfterCutoff0800()) {
    const err: CutoffError = new Error(
      `${action} for ${deliveryDateISO} er stengt etter kl. 08:00 (Oslo-tid).`
    );
    err.code = "CUTOFF";
    throw err;
  }
}

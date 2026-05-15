/** agreement_delivery_days.weekday mapping (EU weekday from ISO date noon UTC). */
const DOW_TO_DAYKEY: Record<number, "mon" | "tue" | "wed" | "thu" | "fri" | undefined> = {
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
};

export function isoDateToAgreementDayKey(dateISO: string): "mon" | "tue" | "wed" | "thu" | "fri" | null {
  const d = new Date(`${dateISO}T12:00:00.000Z`);
  const k = DOW_TO_DAYKEY[d.getUTCDay()];
  return k ?? null;
}

export function normalizeMenuPlanTier(v: unknown): "BASIS" | "LUXUS" | "ENTERPRISE" | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "BASIS" || s === "LUXUS" || s === "ENTERPRISE") return s;
  return null;
}

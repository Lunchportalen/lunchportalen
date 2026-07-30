import "server-only";

export type CapacityMode = "UNLIMITED" | "LIMITED" | "CLOSED";

export type ProviderCapacityDayView = {
  providerId: string;
  serviceDate: string;
  choiceKey: string;
  capacityMode: CapacityMode;
  capacityLimit: number | null;
  reservedQty: number;
  releasedQty: number;
  remainingQty: number | null;
  countryCode: string;
  timezone: string;
  locationId: string | null;
  deliveryWindow: string | null;
  productId: string | null;
  updatedAt: string | null;
};

export type ProviderCapacityPolicyView = {
  providerId: string;
  countryCode: string;
  timezone: string;
  defaultMode: CapacityMode;
  defaultCapacityLimit: number | null;
  migrationDecision: string | null;
};

export function remainingCapacity(mode: CapacityMode, limit: number | null, reserved: number): number | null {
  if (mode === "UNLIMITED") return null;
  if (mode === "CLOSED") return 0;
  if (limit == null) return 0;
  return Math.max(0, limit - reserved);
}

export function parseCapacityMode(raw: unknown): CapacityMode | null {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (v === "UNLIMITED" || v === "LIMITED" || v === "CLOSED") return v;
  return null;
}

/** Kitchen-facing order status labels (maps to public.order_status). */

export type KitchenOrderStatus =
  | "ACTIVE"
  | "LOCKED"
  | "PREPARED"
  | "DISPATCHED"
  | "DELIVERED"
  | "PAUSED"
  | "CANCELLED"
  | "OTHER";

export type KitchenStatusTarget = "PREPARED" | "DISPATCHED" | "DELIVERED";

export type KitchenStatusLabelKey =
  | "received"
  | "inProduction"
  | "readyForDelivery"
  | "delivered"
  | "paused"
  | "cancelled"
  | "other";

export type KitchenActionLabelKey = "startProduction" | "readyForDelivery" | "markDelivered";

export function normalizeKitchenOrderStatus(raw: unknown): KitchenOrderStatus {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "ACTIVE" || s === "LOCKED" || s === "PREPARED" || s === "DISPATCHED" || s === "DELIVERED") {
    return s;
  }
  if (s === "PAUSED" || s === "CANCELLED") return s;
  return "OTHER";
}

/** i18n key under provider.orders.status.* — enum values unchanged. */
export function kitchenStatusLabelKey(status: KitchenOrderStatus): KitchenStatusLabelKey {
  if (status === "ACTIVE" || status === "LOCKED") return "received";
  if (status === "PREPARED") return "inProduction";
  if (status === "DISPATCHED") return "readyForDelivery";
  if (status === "DELIVERED") return "delivered";
  if (status === "PAUSED") return "paused";
  if (status === "CANCELLED") return "cancelled";
  return "other";
}

export function kitchenStatusPillClass(status: KitchenOrderStatus): string {
  const base = "ds-provider-status-pill";
  if (status === "ACTIVE" || status === "LOCKED") return `${base} ds-provider-status-pill--active`;
  if (status === "PREPARED") return `${base} ds-provider-status-pill--prepared`;
  if (status === "DISPATCHED") return `${base} ds-provider-status-pill--dispatched`;
  if (status === "DELIVERED") return `${base} ds-provider-status-pill--delivered`;
  return `${base} ds-provider-status-pill--muted`;
}

/** Next forward step for kitchen progression (null when done or blocked). */
export function nextKitchenTarget(status: KitchenOrderStatus): KitchenStatusTarget | null {
  if (status === "ACTIVE" || status === "LOCKED") return "PREPARED";
  if (status === "PREPARED") return "DISPATCHED";
  if (status === "DISPATCHED") return "DELIVERED";
  return null;
}

/** i18n key under provider.orders.actions.* — target enum unchanged. */
export function targetActionLabelKey(target: KitchenStatusTarget): KitchenActionLabelKey {
  if (target === "PREPARED") return "startProduction";
  if (target === "DISPATCHED") return "readyForDelivery";
  return "markDelivered";
}

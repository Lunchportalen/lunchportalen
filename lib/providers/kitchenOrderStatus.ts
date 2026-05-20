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

export function normalizeKitchenOrderStatus(raw: unknown): KitchenOrderStatus {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "ACTIVE" || s === "LOCKED" || s === "PREPARED" || s === "DISPATCHED" || s === "DELIVERED") {
    return s;
  }
  if (s === "PAUSED" || s === "CANCELLED") return s;
  return "OTHER";
}

export function kitchenStatusLabel(status: KitchenOrderStatus): string {
  if (status === "ACTIVE" || status === "LOCKED") return "Mottatt";
  if (status === "PREPARED") return "I produksjon";
  if (status === "DISPATCHED") return "Klar for levering";
  if (status === "DELIVERED") return "Levert";
  if (status === "PAUSED") return "Pauset";
  if (status === "CANCELLED") return "Avbestilt";
  return "Annet";
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

export function targetActionLabel(target: KitchenStatusTarget): string {
  if (target === "PREPARED") return "Start produksjon";
  if (target === "DISPATCHED") return "Klar for levering";
  return "Marker levert";
}

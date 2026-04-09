import type { ProductEconomics } from "@/lib/product/economics";

export type InventorySignalLevel = "out" | "low" | "normal" | "high";

export function inventorySignal(p: ProductEconomics): InventorySignalLevel {
  if (p.stock === 0) return "out";
  if (p.stock !== undefined && p.stock < 5) return "low";
  if (p.stock !== undefined && p.stock > 50) return "high";
  return "normal";
}

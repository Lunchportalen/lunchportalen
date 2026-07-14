// lib/billing/settlementPolicy.ts
//
// FASE 9 — server-side oppgjørspolicy (kanonisk).
// Plattformens provisjonsoppgjør er INVOICE-ONLY: faktura + manuell
// bankbetaling. Stripe-kodebasen holdes dormant og er EKSPLISITT deaktivert
// bak denne policyen. Kortbetaling kan kun re-aktiveres ved bevisst
// server-side endring (PLATFORM_SETTLEMENT_MODE=card) — aldri implisitt.
import "server-only";

export type SettlementMode = "invoice_only" | "card";

export function settlementMode(): SettlementMode {
  return String(process.env.PLATFORM_SETTLEMENT_MODE ?? "").trim().toLowerCase() === "card" ? "card" : "invoice_only";
}

export function cardChargesEnabled(): boolean {
  return settlementMode() === "card";
}

import "server-only";

/**
 * Canonical B2B model: firm lunch / platform billing is invoice-led (Tripletex + månedlige perioder i DB).
 * Online card checkout for SaaS-abonnement er skrudd av — ingen betaling på site.
 */
export const PAYMENT_POLICY = {
  mode: "invoice_only" as const,
  /** Nettbetaling (Stripe checkout/portal) er av — fakturamodell. */
  allowOnlinePayment: false,
};

export function isOnlinePaymentAllowed(): boolean {
  return PAYMENT_POLICY.allowOnlinePayment === true;
}

/**
 * Kall ved inngang til Stripe checkout / betalingsportal. Kaster når policy forbyr nettbetaling.
 */
export function assertNoOnlinePayment(): void {
  if (!isOnlinePaymentAllowed()) {
    const err = new Error("Online payments are disabled by policy") as Error & { code?: string };
    err.code = "ONLINE_PAYMENT_DISABLED";
    throw err;
  }
}

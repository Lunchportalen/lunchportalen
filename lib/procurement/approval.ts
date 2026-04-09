/**
 * Alle innkjøp krever manuell godkjenning utenfor systemet — ingen auto-place.
 */

export type ProcurementApprovalState = {
  approved: boolean;
  reason: string;
};

export function requireProcurementApproval(order: unknown): ProcurementApprovalState {
  void order;
  return {
    approved: false,
    reason: "Manual approval required",
  };
}

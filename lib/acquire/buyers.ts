export type AcquireBuyer = {
  name: string;
  interest: "high" | "medium" | "low";
};

/**
 * Statisk illustrasjonsliste (ingen ekstern datakilde).
 */
export function findBuyers(): AcquireBuyer[] {
  return [
    { name: "Enterprise SaaS Corp", interest: "high" },
    { name: "Private Equity Fund", interest: "medium" },
  ];
}

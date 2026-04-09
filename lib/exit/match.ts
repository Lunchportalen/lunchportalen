import "server-only";

export type BuyerMatch = { name: string; fit: "high" | "medium" | "low" };

export function matchBuyers(): BuyerMatch[] {
  return [
    { name: "PE Fund", fit: "high" },
    { name: "Strategic SaaS", fit: "medium" },
  ];
}

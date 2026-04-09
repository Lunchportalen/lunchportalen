import "server-only";

export type BuyerProfile = { name: string; type: "financial" | "strategic" };

export function getBuyers(): BuyerProfile[] {
  return [
    { name: "PE Fund", type: "financial" },
    { name: "SaaS Company", type: "strategic" },
  ];
}

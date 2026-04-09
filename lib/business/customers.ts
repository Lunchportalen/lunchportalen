import "server-only";

export type RegisterCustomerInput = {
  company?: unknown;
  email?: unknown;
  note?: unknown;
};

/**
 * In-memory / observability only — no DB writes (RC additive).
 */
export function registerCustomer(input: RegisterCustomerInput): { status: "registered" } {
  console.log("[CUSTOMER_REGISTERED]", {
    company: typeof input.company === "string" ? input.company : null,
    hasEmail: typeof input.email === "string" && input.email.length > 0,
  });

  return { status: "registered" as const };
}

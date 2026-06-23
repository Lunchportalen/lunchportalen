/** Client-safe types + labels for provider SaaS billing (no server-only). */

export type ProviderSubscriptionRow = {
  id: string;
  provider_id: string;
  plan: string;
  monthly_amount: number;
  currency: string;
  tax_code_id: string;
  tax_rate: number;
  billing_email: string;
  billing_org_number: string | null;
  billing_address: string | null;
  active_from: string;
  status: string;
  notes: string | null;
};

export type ProviderInvoiceRow = {
  id: string;
  invoice_number: string | null;
  invoice_period: string;
  amount_net: number;
  amount_tax: number;
  amount_total: number;
  status: string;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export type ProviderBillingBundle = {
  activeSubscription: ProviderSubscriptionRow | null;
  invoices: ProviderInvoiceRow[];
};

/** Legacy Norwegian labels — superadmin/backoffice only; provider UI uses provider.billing.plan.* */
export const PLAN_LABELS: Record<string, string> = {
  SAAS_FIXED: "Fast månedspris",
  SAAS_PER_COMPANY: "Pris per bedrift",
  CUSTOM: "Tilpasset avtale",
};

/** Legacy Norwegian labels — superadmin/backoffice only; provider UI uses provider.billing.status.invoice.* */
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Utkast",
  SENT: "Sendt",
  PAID: "Betalt",
  OVERDUE: "Forfalt",
  VOID: "Annullert",
};

export type ProviderPlanKey = "SAAS_FIXED" | "SAAS_PER_COMPANY" | "CUSTOM";

export type InvoiceStatusKey = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID" | "unknown";

const PROVIDER_PLAN_KEYS = new Set<ProviderPlanKey>(["SAAS_FIXED", "SAAS_PER_COMPANY", "CUSTOM"]);

const INVOICE_STATUS_KEYS = new Set<Exclude<InvoiceStatusKey, "unknown">>([
  "DRAFT",
  "SENT",
  "PAID",
  "OVERDUE",
  "VOID",
]);

/** Maps backend plan code to i18n key id — raw plan string returned when unknown. */
export function providerPlanKey(plan: unknown): ProviderPlanKey | null {
  const s = String(plan ?? "").trim().toUpperCase();
  if (PROVIDER_PLAN_KEYS.has(s as ProviderPlanKey)) return s as ProviderPlanKey;
  return null;
}

/** Maps backend invoice status to i18n key id — never leaks raw enum in UI. */
export function invoiceStatusKey(status: unknown): InvoiceStatusKey {
  const s = String(status ?? "").trim().toUpperCase();
  if (INVOICE_STATUS_KEYS.has(s as Exclude<InvoiceStatusKey, "unknown">)) {
    return s as Exclude<InvoiceStatusKey, "unknown">;
  }
  return "unknown";
}

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

export const PLAN_LABELS: Record<string, string> = {
  SAAS_FIXED: "Fast SaaS-lisens",
  SAAS_PER_COMPANY: "Per bedrift",
  CUSTOM: "Tilpasset avtale",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Utkast",
  SENT: "Sendt",
  PAID: "Betalt",
  OVERDUE: "Forfalt",
  VOID: "Annullert",
};

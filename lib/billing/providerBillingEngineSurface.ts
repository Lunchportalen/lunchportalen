export type BillingProfileSurfaceInput = {
  billingStatus?: string | null;
  billingEmailCurrent?: string | null;
  adminEmails?: ReadonlyArray<string | null | undefined>;
  billingCurrency?: string | null;
  billingTimezone?: string | null;
  commissionRateBps?: number | null;
};

export type PaymentMethodSurfaceInput = {
  brand?: string | null;
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  status?: string | null;
};

export type ProviderCommissionInvoiceSurfaceInput = {
  totalAmountMinor?: number | bigint | null;
  currency?: string | null;
  paymentStatus?: string | null;
  issuedAt?: string | null;
  sentToEmailsSnapshot?: ReadonlyArray<string> | null;
};

export function buildBillingProfileSurface(input: BillingProfileSurfaceInput) {
  const commissionRateBps = input.commissionRateBps ?? 500;
  return {
    billingStatus: input.billingStatus || "setup_required",
    billingEmail: normalizeDisplayEmail(input.billingEmailCurrent),
    adminEmails: (input.adminEmails ?? []).map(normalizeDisplayEmail).filter((v): v is string => Boolean(v)),
    billingCurrency: normalizeCode(input.billingCurrency),
    billingTimezone: input.billingTimezone || "unknown",
    commissionRateLabel: `${formatBpsPercent(commissionRateBps)} %`,
    commissionBasisLabel: "Net lunch sales ex tax",
  };
}

export function buildPaymentMethodSurface(input: PaymentMethodSurfaceInput | null | undefined) {
  if (!input || !input.last4) {
    return {
      hasPaymentMethod: false,
      label: "No card saved",
      status: "missing",
    };
  }

  const brand = String(input.brand ?? "card").trim();
  const last4 = String(input.last4).trim();
  const expMonth = input.expMonth ? String(input.expMonth).padStart(2, "0") : null;
  const expYear = input.expYear ? String(input.expYear) : null;
  const expiry = expMonth && expYear ? ` · ${expMonth}/${expYear}` : "";

  return {
    hasPaymentMethod: true,
    label: `${capitalize(brand)} ending in ${last4}${expiry}`,
    status: input.status || "active",
  };
}

export function buildProviderCommissionInvoiceSurface(input: ProviderCommissionInvoiceSurfaceInput) {
  const currency = normalizeCode(input.currency);
  const totalAmountMinor = toBigIntMinor(input.totalAmountMinor ?? 0);
  return {
    totalLabel: formatMinorCurrency(totalAmountMinor, currency),
    paymentStatus: input.paymentStatus || "pending",
    issuedAt: input.issuedAt ?? null,
    sentToEmails: input.sentToEmailsSnapshot ?? [],
  };
}

function normalizeDisplayEmail(value: string | null | undefined): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return email || null;
}

function normalizeCode(value: string | null | undefined): string {
  const code = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "UNKNOWN";
}

function formatBpsPercent(bps: number): string {
  if (!Number.isInteger(bps) || bps < 0) return "0";
  if (bps % 100 === 0) return String(bps / 100);
  return (bps / 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function toBigIntMinor(value: number | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (!Number.isSafeInteger(value)) throw new Error("MONEY_MINOR_MUST_BE_SAFE_INTEGER");
  return BigInt(value);
}

function formatMinorCurrency(amountMinor: bigint, currency: string): string {
  const sign = amountMinor < BigInt(0) ? "-" : "";
  const abs = amountMinor < BigInt(0) ? -amountMinor : amountMinor;
  const whole = abs / BigInt(100);
  const fractional = (abs % BigInt(100)).toString().padStart(2, "0");
  return `${sign}${whole}.${fractional} ${currency}`;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export const LP_GLOBAL_COMMISSION_RATE_BPS = 500;
export const COMMISSION_BPS_DENOMINATOR = BigInt(10_000);

export type CommissionEventType =
  | "ORDER_COMPLETED"
  | "ORDER_CANCELLED"
  | "ORDER_REFUNDED"
  | "ORDER_CORRECTED"
  | "MANUAL_ADJUSTMENT"
  | "ROUNDING_ADJUSTMENT"
  | "CREDIT_NOTE";

export type InvoiceRecipientType = "billing_email" | "admin" | "owner" | "billing_admin" | "accountant";

export type CommissionExact = {
  numerator: bigint;
  denominator: bigint;
  decimal: string;
  roundedMinor: bigint;
};

export type InvoiceRecipientSnapshot = {
  recipient_email: string;
  recipient_type: InvoiceRecipientType;
};

export type PaymentMethodMetadataInput = {
  provider: string;
  providerPaymentMethodId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  status?: string;
};

export type PaymentMethodMetadata = {
  provider: string;
  providerPaymentMethodId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  status: string;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
const RAW_CARD_KEYS = [
  "card_number",
  "cardNumber",
  "number",
  "pan",
  "cvc",
  "cvv",
  "security_code",
  "securityCode",
];

export function normalizeCurrencyCode(currency: string): string {
  const value = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new Error("INVALID_CURRENCY");
  }
  return value;
}

export function calculateCommissionExactMinor(
  commissionBasisAmountMinor: bigint | number,
  commissionRateBps: number = LP_GLOBAL_COMMISSION_RATE_BPS,
): CommissionExact {
  const basis = toBigIntMinor(commissionBasisAmountMinor);
  if (!Number.isInteger(commissionRateBps) || commissionRateBps < 0 || commissionRateBps > 10_000) {
    throw new Error("INVALID_COMMISSION_RATE_BPS");
  }

  const numerator = basis * BigInt(commissionRateBps);
  const roundedMinor = roundRationalHalfAwayFromZero(numerator, COMMISSION_BPS_DENOMINATOR);

  return {
    numerator,
    denominator: COMMISSION_BPS_DENOMINATOR,
    decimal: rationalToDecimal(numerator, COMMISSION_BPS_DENOMINATOR, 6),
    roundedMinor,
  };
}

export function buildCommissionLedgerIdempotencyKey(input: {
  eventType: CommissionEventType;
  orderId: string;
  orderLineId: string;
}): string {
  return `commission:${input.eventType}:${input.orderId}:${input.orderLineId}`;
}

export function resolveInvoiceRecipientSnapshot(input: {
  billingEmail?: string | null;
  adminEmails?: ReadonlyArray<string | null | undefined>;
}): InvoiceRecipientSnapshot[] {
  const out = new Map<string, InvoiceRecipientSnapshot>();
  const billing = normalizeEmail(input.billingEmail);
  if (billing) out.set(`billing_email:${billing}`, { recipient_email: billing, recipient_type: "billing_email" });

  for (const raw of input.adminEmails ?? []) {
    const email = normalizeEmail(raw);
    if (!email) continue;
    if (billing && email === billing) continue;
    out.set(`admin:${email}`, { recipient_email: email, recipient_type: "admin" });
  }

  return [...out.values()];
}

export function sanitizePaymentMethodMetadata(input: PaymentMethodMetadataInput): PaymentMethodMetadata {
  assertNoRawCardData(input);

  const provider = input.provider.trim().toLowerCase();
  if (!["stripe", "adyen", "nets", "vipps", "manual"].includes(provider)) {
    throw new Error("INVALID_PAYMENT_PROVIDER");
  }

  const last4 = input.last4.trim();
  if (!/^[0-9]{4}$/.test(last4)) throw new Error("INVALID_CARD_LAST4");
  if (!Number.isInteger(input.expMonth) || input.expMonth < 1 || input.expMonth > 12) {
    throw new Error("INVALID_CARD_EXP_MONTH");
  }
  if (!Number.isInteger(input.expYear) || input.expYear < 2024 || input.expYear > 2100) {
    throw new Error("INVALID_CARD_EXP_YEAR");
  }

  return {
    provider,
    providerPaymentMethodId: input.providerPaymentMethodId.trim(),
    brand: input.brand.trim().toLowerCase(),
    last4,
    expMonth: input.expMonth,
    expYear: input.expYear,
    status: input.status?.trim().toLowerCase() || "active",
  };
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email) return null;
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

function toBigIntMinor(value: bigint | number): bigint {
  if (typeof value === "bigint") return value;
  if (!Number.isSafeInteger(value)) throw new Error("MONEY_MINOR_MUST_BE_SAFE_INTEGER");
  return BigInt(value);
}

function roundRationalHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= BigInt(0)) throw new Error("INVALID_DENOMINATOR");
  const sign = numerator < BigInt(0) ? BigInt(-1) : BigInt(1);
  const abs = numerator < BigInt(0) ? -numerator : numerator;
  return sign * ((abs + denominator / BigInt(2)) / denominator);
}

function rationalToDecimal(numerator: bigint, denominator: bigint, scale: number): string {
  if (denominator <= BigInt(0)) throw new Error("INVALID_DENOMINATOR");
  const sign = numerator < BigInt(0) ? "-" : "";
  const abs = numerator < BigInt(0) ? -numerator : numerator;
  const whole = abs / denominator;
  const remainder = abs % denominator;
  const fractional = ((remainder * BigInt(10) ** BigInt(scale)) / denominator).toString().padStart(scale, "0");
  return `${sign}${whole}.${fractional}`;
}

function assertNoRawCardData(input: object): void {
  for (const key of RAW_CARD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      throw new Error("RAW_CARD_DATA_FORBIDDEN");
    }
  }
}

/**
 * E-invoice / CTC adapter contracts (Phase 15G.2).
 * Staging uses mocks only — never claim live government registration from a mock.
 */

import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { E_INVOICE_CAPABILITIES } from "@/lib/invoice/eInvoiceRegistry";

export type EInvoiceDeliveryRequest = {
  countryCode: CountryCode;
  invoiceId: string;
  idempotencyKey: string;
  channel: "pdf_email" | "peppol" | "national_ctc" | "accounting_export";
  payloadHash: string;
};

export type EInvoiceDeliveryResult =
  | {
      ok: true;
      status: "DELIVERED_MOCK";
      deliveryId: string;
      isMock: true;
      liveRegistrationClaimed: false;
    }
  | {
      ok: false;
      code:
        | "ADAPTER_NOT_READY"
        | "CHANNEL_UNSUPPORTED"
        | "CREDENTIAL_REQUIRED"
        | "LEGAL_INVOICE_FORBIDDEN"
        | "IDEMPOTENT_REPLAY";
      message: string;
      credentialDependency: string | null;
      previousDeliveryId?: string;
    };

const seenKeys = new Map<string, Extract<EInvoiceDeliveryResult, { ok: true }>>();

export function deliverEInvoiceStagingMock(req: EInvoiceDeliveryRequest): EInvoiceDeliveryResult {
  const cap = E_INVOICE_CAPABILITIES[req.countryCode];
  if (cap.adapterStatus === "NOT_BUILT") {
    return {
      ok: false,
      code: "ADAPTER_NOT_READY",
      message: `Adapter not built for ${req.countryCode}`,
      credentialDependency: null,
    };
  }
  if (!cap.channels.includes(req.channel)) {
    return {
      ok: false,
      code: "CHANNEL_UNSUPPORTED",
      message: `Channel ${req.channel} unsupported for ${req.countryCode}`,
      credentialDependency: null,
    };
  }

  // Peppol / national CTC require credentials — do not fake live success.
  if (req.channel === "peppol" || req.channel === "national_ctc") {
    return {
      ok: false,
      code: "CREDENTIAL_REQUIRED",
      message: `Live ${req.channel} credentials/registration required for ${req.countryCode}`,
      credentialDependency: `${req.countryCode}:${req.channel}:staging_sandbox`,
    };
  }

  const existing = seenKeys.get(req.idempotencyKey);
  if (existing) {
    return {
      ok: false,
      code: "IDEMPOTENT_REPLAY",
      message: "Idempotent replay of mock delivery",
      credentialDependency: null,
      previousDeliveryId: existing.deliveryId,
    };
  }

  const result: Extract<EInvoiceDeliveryResult, { ok: true }> = {
    ok: true,
    status: "DELIVERED_MOCK",
    deliveryId: `mock_${req.countryCode}_${req.invoiceId}`,
    isMock: true,
    liveRegistrationClaimed: false,
  };
  seenKeys.set(req.idempotencyKey, result);
  return result;
}

export function resetEInvoiceMockStateForTests(): void {
  seenKeys.clear();
}

export function credentialDependencies(): Array<{ countryCode: CountryCode; dependency: string }> {
  const out: Array<{ countryCode: CountryCode; dependency: string }> = [];
  for (const countryCode of Object.keys(E_INVOICE_CAPABILITIES) as CountryCode[]) {
    const cap = E_INVOICE_CAPABILITIES[countryCode];
    if (cap.requirementStatus === "NOT_APPLICABLE") continue;
    if (cap.channels.includes("peppol")) {
      out.push({ countryCode, dependency: `${countryCode}:peppol:access_point_contract` });
    }
    if (cap.channels.includes("national_ctc")) {
      out.push({ countryCode, dependency: `${countryCode}:national_ctc:sandbox_credentials` });
    }
  }
  return out;
}

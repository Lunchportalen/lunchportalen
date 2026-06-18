// lib/providers/providerCustomerAgreementTypes.ts
// Shared read/patch shapes for provider-owned customer agreement editing.

import type { DayKey, Tier } from "@/lib/agreements/normalize";
import type { InvoiceMethod } from "@/lib/providers/providerCustomerBilling";

export type ProviderAgreementDayMenu = {
  day: DayKey;
  plan: Tier;
};

export type ProviderAgreementContact = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type ProviderAgreementBilling = {
  method: InvoiceMethod | null;
  methodLabel: string;
  invoiceEmail: string | null;
  orgnr: string | null;
  ehfEndpoint: string | null;
  contact: ProviderAgreementContact;
  recipientLabel: string;
};

export type ProviderAgreementLocation = {
  id: string;
  name: string | null;
  address: string | null;
};

export type ProviderAgreementDeliveryWindow = {
  from: string | null;
  to: string | null;
  label: string | null;
};

export type ProviderAgreementReadModel = {
  agreementId: string;
  companyId: string;
  providerId: string;
  status: string;
  /** Global fallback tier on agreements.tier */
  defaultPlan: Tier | null;
  deliveryDays: DayKey[];
  dayMenus: ProviderAgreementDayMenu[];
  location: ProviderAgreementLocation;
  contact: ProviderAgreementContact;
  deliveryWindow: ProviderAgreementDeliveryWindow;
  deliveryNote: string | null;
  billing: ProviderAgreementBilling;
  updatedAt: string | null;
  warnings?: string[];
};

export type ProviderAgreementPatchInput = {
  plan?: unknown;
  deliveryDays?: unknown;
  dayMenus?: unknown;
  location?: {
    name?: unknown;
    address?: unknown;
  };
  contact?: {
    name?: unknown;
    email?: unknown;
    phone?: unknown;
  };
  deliveryWindow?: {
    from?: unknown;
    to?: unknown;
    label?: unknown;
  };
  status?: unknown;
  reason?: unknown;
  deliveryNote?: unknown;
  billing?: {
    method?: unknown;
    invoiceEmail?: unknown;
    orgnr?: unknown;
    ehfEndpoint?: unknown;
    contact?: {
      name?: unknown;
      email?: unknown;
      phone?: unknown;
    };
  };
};

export type ProviderAgreementPatchPayload = {
  plan?: Tier;
  deliveryDays?: DayKey[];
  dayMenus?: ProviderAgreementDayMenu[];
  location?: {
    name?: string;
    address?: string;
  };
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  deliveryWindow?: {
    from?: string;
    to?: string;
    label?: string;
  };
  status?: "ACTIVE" | "PAUSED";
  reason?: string | null;
  deliveryNote?: string | null;
  billing?: {
    method: InvoiceMethod;
    invoiceEmail?: string;
    orgnr?: string;
    ehfEndpoint?: string;
    contact?: {
      name?: string;
      email?: string;
      phone?: string;
    };
  };
};

export type ProviderAgreementUpdateResult = ProviderAgreementReadModel & {
  warnings?: string[];
};

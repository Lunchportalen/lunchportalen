// lib/providers/providerCustomerAgreementTypes.ts
// Shared read/patch shapes for provider-owned customer agreement editing.

import type { DayKey, Tier } from "@/lib/agreements/normalize";

export type ProviderAgreementContact = {
  name: string | null;
  email: string | null;
  phone: string | null;
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
  plan: Tier | null;
  deliveryDays: DayKey[];
  location: ProviderAgreementLocation;
  contact: ProviderAgreementContact;
  deliveryWindow: ProviderAgreementDeliveryWindow;
  deliveryNote: string | null;
  updatedAt: string | null;
};

export type ProviderAgreementPatchInput = {
  plan?: unknown;
  deliveryDays?: unknown;
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
};

export type ProviderAgreementPatchPayload = {
  plan?: Tier;
  deliveryDays?: DayKey[];
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
};

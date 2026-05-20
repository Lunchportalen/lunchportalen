/**
 * Provider domain types (PROVIDER-PLAN-V1 §4.1).
 * CamelCase in TypeScript; snake_case DB mapping comes in Patch 5.
 */

export type ProviderStatus = "ACTIVE" | "PAUSED" | "SUSPENDED" | "CLOSED";

export type ProviderRole = "provider_admin" | "provider_kitchen" | "provider_viewer";

export type BillingModel = "SAAS_FIXED" | "SAAS_PER_COMPANY" | "CUSTOM";

export type Provider = {
  id: string;
  name: string;
  slug: string;
  orgNumber: string | null;
  status: ProviderStatus;
  contactEmail: string;
  contactPhone: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  description: string | null;
  billingModel: BillingModel;
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspendedReason: string | null;
  pausedAt: string | null;
  pausedBy: string | null;
  pausedReason: string | null;
  deletedAt: string | null;
};

export type ProviderMembership = {
  id: string;
  userId: string;
  providerId: string;
  role: ProviderRole;
  createdAt: string;
};

export type ProviderServiceArea = {
  id: string;
  providerId: string;
  country: string;
  city: string;
  postalCodeFrom: string;
  postalCodeTo: string;
  minEmployees: number | null;
  maxEmployees: number | null;
  availableDays: readonly string[];
  active: boolean;
  createdAt: string;
};

export const PROVIDER_STATUSES: readonly ProviderStatus[] = ["ACTIVE", "PAUSED", "SUSPENDED", "CLOSED"];

export const PROVIDER_ROLES: readonly ProviderRole[] = [
  "provider_admin",
  "provider_kitchen",
  "provider_viewer",
];

export const BILLING_MODELS: readonly BillingModel[] = ["SAAS_FIXED", "SAAS_PER_COMPANY", "CUSTOM"];

const STATUSES = PROVIDER_STATUSES;
const ROLES = PROVIDER_ROLES;
const MODELS = BILLING_MODELS;

export function isProviderStatus(value: unknown): value is ProviderStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function isProviderRole(value: unknown): value is ProviderRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isBillingModel(value: unknown): value is BillingModel {
  return typeof value === "string" && (MODELS as readonly string[]).includes(value);
}

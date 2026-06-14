// lib/agreements/changeRequestTypes.ts
import type { DayKey, Tier } from "@/lib/agreements/normalize";

export type AgreementChangeRequestStatus =
  | "DRAFT"
  | "PENDING_PROVIDER_APPROVAL"
  | "PENDING_SUPERADMIN_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type AgreementChangeType = "PACKAGE_BY_DAY" | "DELIVERY_DAYS" | "PRICE" | "LOCATION";

export type PackageByDayOverride = Partial<Record<DayKey, { package: Tier }>>;

export type PackageByDayRequestedChange = {
  day_overrides: PackageByDayOverride;
};

export type AgreementChangeRequestRow = {
  id: string;
  provider_id: string;
  company_id: string;
  agreement_id: string;
  requested_by_user_id: string | null;
  requested_by_role: string;
  status: AgreementChangeRequestStatus;
  effective_from: string;
  effective_to: string | null;
  change_type: AgreementChangeType;
  requested_change: PackageByDayRequestedChange | Record<string, unknown>;
  current_snapshot: Record<string, unknown>;
  note: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  rejected_by_user_id: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type AgreementTierSource = "BASE_AGREEMENT" | "APPROVED_CHANGE_REQUEST" | "AGREEMENT_VERSION";

export type ResolvedAgreementForDate = {
  ok: true;
  companyId: string;
  locationId: string | null;
  date: string;
  agreementId: string;
  providerId: string;
  agreementStatus: "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING" | "MISSING";
  deliveryAllowed: boolean;
  dayKey: DayKey | null;
  tier: Tier | null;
  dayOverride: { dayKey: DayKey; tier: Tier } | null;
  tierSource: AgreementTierSource;
  changeRequestId: string | null;
  baseDayTiers: Partial<Record<DayKey, Tier>>;
};

export type ResolvedAgreementForDateError = {
  ok: false;
  error: "BAD_INPUT" | "NO_AGREEMENT" | "WEEKEND" | "NOT_DELIVERY_DAY";
  message: string;
};

export type ResolvedAgreementForDateResult = ResolvedAgreementForDate | ResolvedAgreementForDateError;

export type AgreementSnapshotForResolver = {
  agreementId: string;
  companyId: string;
  locationId: string | null;
  providerId: string;
  status: string;
  deliveryDays: DayKey[];
  dayTiers: Partial<Record<DayKey, Tier>>;
};

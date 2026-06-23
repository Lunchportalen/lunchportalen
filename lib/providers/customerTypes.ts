export type ProviderCustomerFilter = "all" | "active" | "suspended" | "paused" | "deleted";

export type ProviderCustomerStatus = "ACTIVE" | "PAUSED" | "SUSPENDED" | "DELETED";

export type ProviderCustomerRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: ProviderCustomerStatus;
  employeesCount: number | null;
  ordersThisWeek: number | null;
  historicalOrdersCount: number | null;
  invoiceMethodLabel: string;
  updatedAt: string | null;
};

export type ProviderCustomersPage = {
  customers: ProviderCustomerRow[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  /** Statuschip-tellinger for hele det søk-filtrerte datasettet (uavhengig av aktivt statusfilter). */
  statusCounts: Record<ProviderCustomerFilter, number>;
};

export function providerCustomerStatusLabelKey(
  status: ProviderCustomerStatus,
): "active" | "paused" | "suspended" | "deleted" {
  if (status === "ACTIVE") return "active";
  if (status === "PAUSED") return "paused";
  if (status === "SUSPENDED") return "suspended";
  return "deleted";
}

/** @deprecated Prefer providerCustomerStatusLabelKey + i18n — kept for detail page until follow-up PR. */
export function providerCustomerStatusLabel(status: ProviderCustomerStatus): string {
  if (status === "ACTIVE") return "Aktiv";
  if (status === "PAUSED") return "Pauset";
  if (status === "SUSPENDED") return "Suspendert";
  return "Slettet";
}

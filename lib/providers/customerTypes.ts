export type ProviderCustomerFilter = "all" | "active" | "suspended" | "paused" | "deleted";

export type ProviderCustomerStatus = "ACTIVE" | "PAUSED" | "SUSPENDED" | "DELETED";

export type ProviderCustomerRow = {
  id: string;
  name: string;
  status: ProviderCustomerStatus;
  employeesCount: number;
  ordersThisWeek: number;
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

export function providerCustomerStatusLabel(status: ProviderCustomerStatus): string {
  if (status === "ACTIVE") return "Aktiv";
  if (status === "PAUSED") return "Pauset";
  if (status === "SUSPENDED") return "Suspendert";
  return "Slettet";
}

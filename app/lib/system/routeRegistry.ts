// lib/system/routeRegistry.ts
import "server-only";

/* =========================================================
   Types
========================================================= */

export type GuardStandard = "dag3" | "legacy" | "unknown";

export type RouteOwner =
  | "orders"
  | "admin"
  | "superadmin"
  | "kitchen"
  | "driver"
  | "system";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RouteRegistryItem = {
  id: string;            // stabil, aldri endres
  method: HttpMethod;
  path: string;          // /api/...
  owner: RouteOwner;
  standard: GuardStandard;
  notes?: string;
};

/* =========================================================
   Registry (enterprise proof)
========================================================= */

export const ROUTE_REGISTRY: RouteRegistryItem[] = [
  /* -------------------------
     Orders
  ------------------------- */
  {
    id: "orders-toggle-post",
    method: "POST",
    path: "/api/orders/toggle",
    owner: "orders",
    standard: "legacy",
    notes: "Eldre endpoint – migreres til Dag-3 routeGuard.",
  },
  {
    id: "orders-cancel-post",
    method: "POST",
    path: "/api/orders/cancel",
    owner: "orders",
    standard: "legacy",
    notes: "Eldre endpoint – migreres til Dag-3 routeGuard.",
  },

  /* -------------------------
     Admin
  ------------------------- */
  {
    id: "admin-orders-get",
    method: "GET",
    path: "/api/admin/orders",
    owner: "admin",
    standard: "legacy",
    notes: "Admin-visning, mangler Dag-3 standard.",
  },

  /* -------------------------
     Kitchen
  ------------------------- */
  {
    id: "kitchen-orders-get",
    method: "GET",
    path: "/api/kitchen/orders",
    owner: "kitchen",
    standard: "legacy",
    notes: "Produksjonsvisning, migreres senere.",
  },

  /* -------------------------
     System
  ------------------------- */
  {
    id: "system-health-get",
    method: "GET",
    path: "/api/system/health",
    owner: "system",
    standard: "dag3",
    notes: "Health endpoint (Dag-3: scope + role + no-store + rid).",
  },
];

/* =========================================================
   Helpers
========================================================= */

export function summarizeRegistry(items: RouteRegistryItem[]) {
  const total = items.length;
  const dag3 = items.filter((x) => x.standard === "dag3").length;
  const legacy = items.filter((x) => x.standard === "legacy").length;
  const unknown = items.filter((x) => x.standard === "unknown").length;

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return {
    total,
    dag3,
    legacy,
    unknown,
    pctDag3: pct(dag3),
    pctLegacy: pct(legacy),
    pctUnknown: pct(unknown),
  };
}

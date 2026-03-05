"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type TenantItem = { id: string; slug: string; name: string; status?: string };

type TenantsState = {
  tenantsOk: boolean | null;
  tenants: TenantItem[];
  loading: boolean;
};

const BackofficeTenantsContext = createContext<TenantsState | null>(null);

export function BackofficeTenantsProvider({ children }: { children: ReactNode }) {
  const [tenantsOk, setTenantsOk] = useState<boolean | null>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const didLoadRef = useRef(false);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    fetch("/api/backoffice/tenants", { method: "GET", cache: "no-store" })
      .then((res) => {
        setTenantsOk(res.ok);
        return res.ok ? res.json() : null;
      })
      .then((data: { ok?: boolean; tenants?: TenantItem[] } | null) => {
        if (data?.ok && Array.isArray(data.tenants)) {
          setTenants(data.tenants);
        }
      })
      .catch(() => {
        setTenantsOk(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const state: TenantsState = { tenantsOk, tenants, loading };

  return <BackofficeTenantsContext.Provider value={state}>{children}</BackofficeTenantsContext.Provider>;
}

export function useBackofficeTenants(): TenantsState {
  const ctx = useContext(BackofficeTenantsContext);
  if (!ctx) {
    return { tenantsOk: null, tenants: [], loading: true };
  }
  return ctx;
}


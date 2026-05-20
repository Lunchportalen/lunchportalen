// app/leverandor/kunder/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";

import CustomerList from "@/components/providers/CustomerList";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { loadProviderCustomers, type ProviderCustomerFilter } from "@/lib/providers/loadProviderCustomers";

function parseFilter(raw: string | undefined): ProviderCustomerFilter {
  const v = String(raw ?? "all").toLowerCase();
  if (v === "active" || v === "suspended" || v === "paused" || v === "deleted") return v;
  return "all";
}

export default async function LeverandorKunderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) redirect("/login?next=%2Fleverandor%2Fkunder");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) redirect("/leverandor");

  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) redirect("/leverandor");

  const sp = await searchParams;
  const filter = parseFilter(typeof sp.filter === "string" ? sp.filter : undefined);
  const search = typeof sp.q === "string" ? sp.q : "";
  const page = typeof sp.page === "string" ? Number(sp.page) : 1;

  const list = await loadProviderCustomers(provider.id, filter, search, page);

  return (
    <div className="ds-container">
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">Leverandør</p>
          <h1 className="ds-h2">Kunder</h1>
          <p className="ds-lead">Administrer bedrifter under {provider.name}.</p>
        </div>
      </header>
      <CustomerList initial={list} />
    </div>
  );
}

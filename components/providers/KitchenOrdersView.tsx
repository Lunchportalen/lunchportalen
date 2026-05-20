"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import KitchenFilters from "@/components/providers/KitchenFilters";
import KitchenOrderCard from "@/components/providers/KitchenOrderCard";
import type { KitchenOrdersBundle } from "@/lib/providers/loadKitchenOrders";

function groupOrders(bundle: KitchenOrdersBundle, mode: string) {
  const map = new Map<string, typeof bundle.orders>();
  for (const order of bundle.orders) {
    const key = mode === "slot" ? `${order.date}|${order.slot ?? "—"}` : order.companyId;
    const list = map.get(key) ?? [];
    list.push(order);
    map.set(key, list);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "nb"));
}

export default function KitchenOrdersView({
  bundle,
  canAdvance,
  groupMode,
}: {
  bundle: KitchenOrdersBundle;
  canAdvance: boolean;
  groupMode: string;
}) {
  const router = useRouter();
  const groups = groupOrders(bundle, groupMode);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <div className="ds-section">
      <KitchenFilters companies={bundle.companies} />

      {bundle.orders.length === 0 ? (
        <p className="ds-body">Ingen ordrer i valgt periode.</p>
      ) : (
        <div className="ds-provider-kitchen-grid">
          {groups.map(([key, orders]) => (
            <section key={key} className="ds-provider-kitchen-group">
              <h2 className="ds-h2">
                {groupMode === "slot"
                  ? `Levering ${orders[0]?.slot ?? "—"} · ${orders[0]?.date ?? ""}`
                  : orders[0]?.companyName ?? key}
              </h2>
              <div className="ds-provider-kitchen-stack">
                {orders.map((order) => (
                  <KitchenOrderCard key={order.id} order={order} canAdvance={canAdvance} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

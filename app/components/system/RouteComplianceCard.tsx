// components/system/RouteComplianceCard.tsx
import type { RouteRegistryItem } from "@/lib/system/routeRegistry";
import { summarizeRegistry } from "@/lib/system/routeRegistry";

function badgeClass(standard: RouteRegistryItem["standard"]) {
  if (standard === "dag3") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (standard === "legacy") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-neutral-50 text-neutral-700 border-neutral-200";
}

function badgeText(standard: RouteRegistryItem["standard"]) {
  if (standard === "dag3") return "Dag-3 standard";
  if (standard === "legacy") return "Legacy";
  return "Ukjent";
}

export default function RouteComplianceCard({ items }: { items: RouteRegistryItem[] }) {
  const s = summarizeRegistry(items);

  return (
    <section className="rounded-2xl border bg-white shadow-sm p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">API Route Compliance</h2>
          <p className="mt-1 text-neutral-600">
            Internt register over hvilke ruter som følger standard guard (rid/no-store/scope/role).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-neutral-700">
            Total: <span className="font-semibold">{s.total}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-emerald-700 border-emerald-200 bg-emerald-50">
            Dag-3: <span className="font-semibold">{s.dag3}</span> ({s.pctDag3}%)
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-amber-700 border-amber-200 bg-amber-50">
            Legacy: <span className="font-semibold">{s.legacy}</span> ({s.pctLegacy}%)
          </span>
          {s.unknown ? (
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-neutral-700">
              Ukjent: <span className="font-semibold">{s.unknown}</span> ({s.pctUnknown}%)
            </span>
          ) : null}
        </div>
      </header>

      <div className="mt-4 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold text-neutral-700 w-24">Method</th>
              <th className="px-4 py-3 font-semibold text-neutral-700">Path</th>
              <th className="px-4 py-3 font-semibold text-neutral-700 w-32">Owner</th>
              <th className="px-4 py-3 font-semibold text-neutral-700 w-40">Standard</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id} className="border-t">
                <td className="px-4 py-3 font-mono">{x.method}</td>
                <td className="px-4 py-3">
                  <div className="font-mono text-neutral-800">{x.path}</div>
                  {x.notes ? <div className="mt-1 text-xs text-neutral-500">{x.notes}</div> : null}
                </td>
                <td className="px-4 py-3 text-neutral-700">{x.owner}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${badgeClass(x.standard)}`}>
                    {badgeText(x.standard)}
                  </span>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-600" colSpan={4}>
                  Registry er tom. Legg inn ruter i <span className="font-mono">lib/system/routeRegistry.ts</span>.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-neutral-500">
        Prinsipp: dette registeret skal kun markere “Dag-3 standard” når ruten faktisk bruker standard routeGuard + rid + no-store.
      </div>
    </section>
  );
}

// components/system/HealthCard.tsx
import type { HealthReport, HealthStatus } from "@/lib/system/health";

function badge(status: HealthStatus) {
  if (status === "ok") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "fail") return "bg-red-50 text-red-700 border-red-200";
  if (status === "warn") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-neutral-50 text-neutral-700 border-neutral-200";
}

function label(status: HealthStatus) {
  if (status === "ok") return "OK";
  if (status === "fail") return "FAIL";
  if (status === "warn") return "WARN";
  return "SKIP";
}

function safe(v: unknown) {
  return String(v ?? "—");
}

export default function HealthCard({ report }: { report: HealthReport }) {
  return (
    <section className="rounded-2xl border bg-white shadow-sm p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">System Health</h2>
          <p className="mt-1 text-neutral-600">
            Driftssjekk (runtime, database, Sanity, tidssone). Dette er faktisk systemstatus.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${
              badge(report.ok ? "ok" : "fail")
            }`}
          >
            <span className="font-semibold">
              {report.ok ? "HEALTHY" : "DEGRADED"}
            </span>
          </span>

          <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-neutral-700">
            Oslo dato:
            <span className="ml-2 font-mono font-semibold">
              {safe(report.todayOslo)}
            </span>
          </span>

          <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-neutral-700">
            <span className="font-mono">{safe(report.timestamp)}</span>
          </span>
        </div>
      </header>

      <div className="mt-4 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold text-neutral-700 w-40">
                Check
              </th>
              <th className="px-4 py-3 font-semibold text-neutral-700 w-24">
                Status
              </th>
              <th className="px-4 py-3 font-semibold text-neutral-700">
                Message
              </th>
            </tr>
          </thead>
          <tbody>
            {report.checks.map((c) => (
              <tr key={c.key} className="border-t align-top">
                <td className="px-4 py-3 text-neutral-800">
                  {c.label}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${badge(
                      c.status
                    )}`}
                  >
                    {label(c.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-neutral-800">{c.message}</div>
                  {c.detail ? (
                    <pre className="mt-2 text-xs overflow-auto rounded-lg border bg-neutral-50 p-3 text-neutral-700">
{JSON.stringify(c.detail, null, 2)}
                    </pre>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-neutral-500">
        OK = verifisert · WARN = degradert/valgfritt · FAIL = driftshull
      </div>
    </section>
  );
}

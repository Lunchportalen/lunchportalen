// app/superadmin/_components/OperationalStatusStrip.tsx
import "server-only";

import Link from "next/link";
import { headers } from "next/headers";

import { osloTodayISODate } from "@/lib/date/oslo";
import { loadProductionReadiness } from "@/lib/server/superadmin/loadProductionReadiness";
import { operationalStatusStripPresentation } from "@/lib/superadmin/operationalStatusStripPresentation";

function variantClass(v: ReturnType<typeof operationalStatusStripPresentation>["variant"]) {
  if (v === "ok") return "border-emerald-200/90 bg-emerald-50/90 text-emerald-950";
  if (v === "warn") return "border-amber-200/90 bg-amber-50/90 text-amber-950";
  if (v === "blocked") return "border-red-200/90 bg-red-50/90 text-red-950";
  if (v === "neutral") return "border-neutral-200/90 bg-neutral-50/90 text-neutral-800";
  return "border-rose-200/90 bg-rose-50/90 text-rose-950";
}

export default async function OperationalStatusStrip() {
  try {
    const h = await headers();
    const raw = h.get("x-url") || h.get("next-url") || h.get("referer") || "";
    if (raw) {
      const u = new URL(raw);
      if (u.pathname.startsWith("/superadmin/production-check")) return null;
    }
  } catch {
    // vis strip likevel
  }

  const date = osloTodayISODate();
  const p = await loadProductionReadiness(date);
  const pres = operationalStatusStripPresentation(p.level);

  const href = `/superadmin/production-check?date=${encodeURIComponent(date)}`;
  const sub =
    p.level === "READY" || p.level === "READY_WITH_WARNINGS"
      ? `${p.operative_orders} operative ordre · ${p.operative_companies} firma · ${p.operative_locations} lokasjoner`
      : p.level === "NOT_DELIVERY_DAY"
        ? p.detail
        : p.level === "BLOCKED_GLOBAL_CLOSED"
          ? p.global_closed_reason || p.detail
          : p.detail;

  return (
    <div
      className={[
        "mt-3 flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between",
        variantClass(pres.variant),
      ].join(" ")}
      role="status"
      aria-label={pres.label}
    >
      <div className="min-w-0">
        <div className="font-semibold leading-snug">{pres.label}</div>
        <div className="mt-0.5 text-xs opacity-90 leading-snug">{sub}</div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-xs opacity-80">{date}</span>
        <Link href={href} className="text-xs font-semibold underline underline-offset-2 hover:opacity-90">
          Produksjonssjekk →
        </Link>
      </div>
    </div>
  );
}

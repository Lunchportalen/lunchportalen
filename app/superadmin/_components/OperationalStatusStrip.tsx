// app/superadmin/_components/OperationalStatusStrip.tsx
import "server-only";

import Link from "next/link";
import { headers } from "next/headers";

import { osloTodayISODate } from "@/lib/date/oslo";
import { loadProductionReadiness } from "@/lib/server/superadmin/loadProductionReadiness";
import { operationalStatusStripPresentation } from "@/lib/superadmin/operationalStatusStripPresentation";

function variantClass(v: ReturnType<typeof operationalStatusStripPresentation>["variant"]) {
  if (v === "ok") return "bg-emerald-50/80 text-emerald-950 ring-1 ring-emerald-200/70";
  if (v === "warn") return "bg-amber-50/85 text-amber-950 ring-1 ring-amber-200/70";
  if (v === "blocked") return "bg-red-50/85 text-red-950 ring-1 ring-red-200/70";
  if (v === "neutral") return "bg-neutral-50/90 text-neutral-800 ring-1 ring-neutral-200/70";
  return "bg-rose-50/85 text-rose-950 ring-1 ring-rose-200/70";
}

export default async function OperationalStatusStrip({ placement = "layout" }: { placement?: "layout" | "embedded" }) {
  let pathname = "";
  try {
    const h = await headers();
    const raw = h.get("x-url") || h.get("next-url") || h.get("referer") || "";
    if (raw) {
      const u = new URL(raw);
      pathname = u.pathname;
      if (u.pathname.startsWith("/superadmin/production-check")) return null;
    }
  } catch {
    // vis strip likevel
  }

  if (placement === "layout" && (pathname === "/superadmin" || pathname === "/superadmin/")) {
    return null;
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
  const title = p.level === "ERROR" ? "Produksjon i dag: status utilgjengelig" : pres.label;
  const errorDetail = p.level === "ERROR" && p.detail ? `Teknisk detalj: ${p.detail}` : null;

  return (
    <div
      data-superadmin-operational-strip={placement}
      className={[
        placement === "embedded" ? "mt-5" : "mt-3",
        "flex flex-col gap-2 rounded-[1.15rem] px-3.5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
        variantClass(pres.variant),
      ].join(" ")}
      role="status"
      aria-label={pres.label}
    >
      <div className="min-w-0">
        <div className="font-semibold leading-snug">{title}</div>
        <div className="mt-0.5 text-xs leading-snug opacity-80">
          {p.level === "ERROR" ? "Kunne ikke hente produksjonsstatus akkurat nå. Se produksjonssjekk for detaljer." : sub}
        </div>
        {errorDetail ? <div className="mt-1 max-w-full truncate font-mono text-[11px] opacity-55">{errorDetail}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs">
        <span className="font-mono text-xs opacity-80">{date}</span>
        <Link href={href} className="font-semibold underline underline-offset-2 hover:opacity-90">
          Produksjonssjekk →
        </Link>
      </div>
    </div>
  );
}

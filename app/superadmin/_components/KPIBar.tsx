"use client";

import AnimatedNumber from "./AnimatedNumber";
import { highlightStyle } from "@/lib/demo/highlight";
import { useDemoModeActive } from "@/lib/demo/useDemoModeActive";
import { ui } from "@/lib/ui/tokens";

type KPIPayload = {
  revenue: number;
  forecast: number;
  leads: number;
};

export default function KPIBar({ data }: { data?: KPIPayload | null }) {
  const demo = useDemoModeActive();

  if (!data) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: ui.spacing.md,
        marginBottom: ui.spacing.lg,
        ...highlightStyle(demo),
      }}
    >
      <div>
        <strong className="text-[rgb(var(--lp-muted))] text-xs font-semibold uppercase tracking-wide">Revenue</strong>
        <div className="font-heading text-2xl font-semibold tabular-nums text-[rgb(var(--lp-fg))]" style={{ fontSize: 24 }}>
          <AnimatedNumber value={data.revenue} /> kr
        </div>
      </div>

      <div>
        <strong className="text-[rgb(var(--lp-muted))] text-xs font-semibold uppercase tracking-wide">Forecast</strong>
        <div className="font-heading text-2xl font-semibold tabular-nums text-[rgb(var(--lp-fg))]" style={{ fontSize: 24 }}>
          <AnimatedNumber value={data.forecast} /> kr
        </div>
      </div>

      <div>
        <strong className="text-[rgb(var(--lp-muted))] text-xs font-semibold uppercase tracking-wide">Leads</strong>
        <div className="font-heading text-2xl font-semibold tabular-nums text-[rgb(var(--lp-fg))]" style={{ fontSize: 24 }}>
          <AnimatedNumber value={data.leads} />
        </div>
      </div>
    </div>
  );
}

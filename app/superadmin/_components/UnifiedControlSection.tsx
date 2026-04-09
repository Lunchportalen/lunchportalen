"use client";

import { useEffect, useState } from "react";

import { buildControlView, type ControlViewModel } from "@/lib/controlTower/viewModel";
import { slideUp } from "@/lib/ui/motion";

import ActionPanel from "./ActionPanel";
import AIStatus from "./AIStatus";
import Card from "./Card";
import KPIBar from "./KPIBar";
import Skeleton from "./Skeleton";

const staggerBase = {
  ...slideUp,
  animationFillMode: "both" as const,
};

const fadeInStyle = {
  animation: "fadeIn 0.4s ease forwards",
  animationFillMode: "both" as const,
};

export default function UnifiedControlSection() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ControlViewModel | null>(null);

  useEffect(() => {
    const run = () => {
      fetch("/api/superadmin/control-tower/snapshot", { cache: "no-store", credentials: "include" })
        .then((r) => r.json().catch(() => null))
        .then((data) => {
          if (data && typeof data === "object") {
            try {
              setView(buildControlView(data));
            } catch {
              setView(null);
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 1200 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 0);
    return () => window.clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="mb-6" style={{ ...fadeInStyle }}>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    );
  }

  if (!view) return null;

  return (
    <div className="mb-6" style={{ ...fadeInStyle }}>
      <div style={{ ...staggerBase, animationDelay: "50ms" }}>
        <AIStatus />
      </div>

      <div style={{ ...staggerBase, animationDelay: "100ms" }}>
        <KPIBar data={view} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]" style={{ ...staggerBase, animationDelay: "150ms" }}>
        <Card>
          <h2 className="font-heading text-xl font-semibold text-[rgb(var(--lp-fg))]">Kontrolltårn</h2>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Samlet oversikt over hele systemet</p>
        </Card>

        <ActionPanel actions={view.actions} />
      </div>
    </div>
  );
}

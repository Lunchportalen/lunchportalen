// app/admin/menus/MenusClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type DayStatus = "published" | "unpublished" | "missing";

type MenuDay = {
  date: string;           // YYYY-MM-DD
  weekday: string;        // Man/Tir/...
  title?: string | null;
  description?: string | null;
  allergens?: string[] | null;
  status: DayStatus;
};

type WeekResp = {
  week: string;           // YYYY-Www
  days: MenuDay[];
};

export default function MenusClient() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [data, setData] = useState<WeekResp | null>(null);

  async function load() {
    setState("loading");
    try {
      const r = await fetch(`/api/superadmin/menus-week?offset=${weekOffset}`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Kunne ikke hente meny");
      setData(j.week);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    load();
  }, [weekOffset]);

  const canPublishAll = useMemo(() => {
    if (!data) return false;
    return data.days.every((d) => d.status !== "missing");
  }, [data]);

  async function setPublish(date: string, publish: boolean) {
    await fetch("/api/superadmin/menu-publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, publish }),
    });
    await load();
  }

  if (state === "loading") {
    return (
      <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
        Laster meny…
      </div>
    );
  }

  if (state === "error" || !data) {
    return (
      <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
        Kunne ikke laste meny.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="lp-btn" onClick={() => setWeekOffset((v) => v - 1)}>
          ← Forrige uke
        </button>
        <button className="lp-btn" onClick={() => setWeekOffset((v) => v + 1)}>
          Neste uke →
        </button>

        <div className="ml-auto flex gap-2">
          <button
            className="lp-btn-primary"
            disabled={!canPublishAll}
            onClick={async () => {
              for (const d of data.days) {
                if (d.status !== "published") {
                  await setPublish(d.date, true);
                }
              }
            }}
          >
            Publiser hele uka
          </button>
        </div>
      </div>

      {/* Days */}
      <div className="divide-y rounded-3xl bg-white ring-1 ring-[rgb(var(--lp-border))]">
        {data.days.map((d) => (
          <div key={d.date} className="px-5 py-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">
                {d.weekday} {d.date}
              </div>
              <div className="text-sm text-[rgb(var(--lp-muted))]">
                {d.title ?? "— Ingen tittel —"}
              </div>
              <div className="text-xs text-[rgb(var(--lp-muted))]">
                {d.allergens?.length ? `Allergener: ${d.allergens.join(", ")}` : "Ingen allergener"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={
                  d.status === "published"
                    ? "lp-chip lp-chip-ok"
                    : d.status === "missing"
                    ? "lp-chip lp-chip-warn"
                    : "lp-chip lp-chip-neutral"
                }
              >
                {d.status === "published"
                  ? "Publisert"
                  : d.status === "missing"
                  ? "Mangler innhold"
                  : "Ikke publisert"}
              </span>

              <button
                className="lp-btn"
                disabled={d.status === "missing"}
                onClick={() => setPublish(d.date, d.status !== "published")}
              >
                {d.status === "published" ? "Avpubliser" : "Publiser"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

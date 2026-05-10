"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { createClient as createBrowserClient } from "@/lib/supabase/client";

type FeedItem = {
  id: string;
  tone: "green" | "blue" | "red";
  text: string;
  ts: string;
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function toneClass(tone: FeedItem["tone"]) {
  if (tone === "red") return "bg-red-50 text-red-950 ring-red-200";
  if (tone === "blue") return "bg-blue-50 text-blue-950 ring-blue-200";
  return "bg-emerald-50 text-emerald-950 ring-emerald-200";
}

function readCompanyName(payload: any) {
  return (
    safeStr(payload?.data?.company?.name) ||
    safeStr(payload?.data?.name) ||
    safeStr(payload?.company?.name) ||
    safeStr(payload?.name) ||
    null
  );
}

export default function SuperadminRealtimeFeed({ initialOrdersToday }: { initialOrdersToday: number }) {
  const [ordersToday, setOrdersToday] = useState(initialOrdersToday);
  const [items, setItems] = useState<FeedItem[]>([]);
  const companyNameCache = useRef<Map<string, string>>(new Map());

  function pushItem(item: Omit<FeedItem, "id" | "ts">) {
    setItems((prev) =>
      [
        { ...item, id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, ts: new Date().toISOString() },
        ...prev,
      ].slice(0, 12)
    );
  }

  async function resolveCompanyName(companyId: string) {
    const id = safeStr(companyId);
    if (!id) return null;
    const cached = companyNameCache.current.get(id);
    if (cached) return cached;

    try {
      const res = await fetch(`/api/superadmin/companies/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      const name = readCompanyName(json);
      if (name) companyNameCache.current.set(id, name);
      return name;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    const supabase = createBrowserClient();

    const ordersChannel = supabase
      .channel("superadmin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        if (payload.eventType === "INSERT") setOrdersToday((value) => value + 1);

        const row = payload.new as any;
        const companyId = safeStr(row?.company_id);
        const date = safeStr(row?.date);
        void resolveCompanyName(companyId).then((companyName) => {
          pushItem({
            tone: "green",
            text: companyName
              ? `${companyName} bestilte${date ? ` ${date}` : ""}`
              : "Ny ordre registrert",
          });
        });
      })
      .subscribe();

    const batchChannel = supabase
      .channel("superadmin-batches")
      .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_batches" }, (payload) => {
        const row = payload.new as any;
        const status = safeStr(row?.status).toUpperCase();
        const slot = safeStr(row?.delivery_window) || "leveranse";
        if (status === "PACKED") {
          pushItem({ tone: "blue", text: `Kjøkken pakket ${slot}` });
        } else if (status === "DELIVERED") {
          pushItem({ tone: "green", text: `Levert ${slot}` });
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(ordersChannel);
      void supabase.removeChannel(batchChannel);
    };
  }, []);

  const statusText = useMemo(() => (items.length ? "Live hendelser" : "Venter på hendelser"), [items.length]);

  return (
    <section className="mt-7 rounded-[1.35rem] bg-white/80 p-4 ring-1 ring-black/[0.05]" aria-labelledby="superadmin-live-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="superadmin-live-heading" className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">
            Live drift
          </h2>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{statusText}</p>
        </div>
        <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-950 ring-1 ring-emerald-200">
          Ordre i dag: {ordersToday}
        </div>
      </div>

      <div className="mt-4 space-y-2" aria-live="polite">
        {items.length === 0 ? (
          <p className="rounded-2xl bg-[#fbf8f0] px-3 py-2 text-sm text-[rgb(var(--lp-muted))]">
            Ingen nye live-hendelser i denne økten.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`rounded-2xl px-3 py-2 text-sm font-medium ring-1 ${toneClass(item.tone)}`}>
              {item.text}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

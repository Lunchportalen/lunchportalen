"use client";

// STATUS: KEEP

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatDateNO } from "@/lib/date/format";

type MyOrder = {
  id?: string | null;
  status?: string | null;
  date?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  note?: string | null;
  slot?: string | null;
};

type ApiResp =
  | {
      ok: true;
      rid: string;
      data: {
        allowed: boolean;
        reason: string | null;
        cutoff: { status: string; time: string; locked: boolean };
        tierToday: "BASIS" | "LUXUS" | null;
        myOrder: MyOrder | null;
      };
    }
  | { ok: false; rid: string; error: string; message: string };

function isActive(order: MyOrder | null) {
  const s = String(order?.status ?? "").toUpperCase();
  return s === "ACTIVE" || s === "QUEUED" || s === "PACKED" || s === "DELIVERED";
}

export default function MyLunchCard() {
  const router = useRouter();
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/orders/my", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiResp | null;
      setData(json ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function place() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/orders/my", { method: "POST", cache: "no-store" });
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/orders/my", { method: "DELETE", cache: "no-store" });
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !data) {
    return <div className="text-sm text-[rgb(var(--lp-muted))]">Henter status…</div>;
  }

  if (!data.ok) {
    return (
      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 px-4 py-3 text-sm text-[rgb(var(--lp-text))]">
        Kunne ikke hente lunsjstatus. RID: {data.rid}
      </div>
    );
  }

  const { allowed, reason, cutoff, tierToday, myOrder } = data.data;
  const active = isActive(myOrder);
  const dateLabel = myOrder?.date ? formatDateNO(myOrder.date) : "I dag";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Min lunsj</div>
          <div className="mt-1 text-lg font-semibold text-[rgb(var(--lp-text))]">{dateLabel}</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Cut-off {cutoff.time} · {cutoff.locked ? "Låst" : "Åpen"}
          </div>
        </div>
        <div className="text-xs text-[rgb(var(--lp-muted))]">Tier: {tierToday ?? "—"}</div>
      </div>

      <div className="text-sm text-[rgb(var(--lp-text))]">
        Status: <span className="font-semibold">{active ? "Bestilt" : "Ikke bestilt"}</span>
      </div>

      {reason ? (
        <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 px-4 py-3 text-sm text-[rgb(var(--lp-muted))]">
          {reason}
        </div>
      ) : null}

      <div className="relative z-10 flex flex-wrap gap-2">
        <Button
          onClick={place}
          disabled={!allowed || active || busy}
        >
          Bestill lunsj
        </Button>
        <Button variant="secondary" onClick={cancel} disabled={!allowed || !active || busy}>
          Avbestill
        </Button>
      </div>
    </div>
  );
}

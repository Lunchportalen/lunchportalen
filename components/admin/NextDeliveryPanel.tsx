// components/admin/NextDeliveryPanel.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Person = {
  id: string;
  name: string;
  email?: string | null;
  department?: string | null;
  status: "QUEUED" | "PACKED" | "DELIVERED" | string;
  note?: string | null;
};

type Location = {
  locationId: string;
  locationName: string;
  address?: string | null;
  people: Person[];
};

type Company = {
  companyId: string;
  companyName: string;
  locations: Location[];
};

type WindowGroup = {
  windowLabel: string;
  companies: Company[];
};

type ApiOk = {
  ok: true;
  rid: string;
  date: string;
  windows: WindowGroup[];
};

type ApiErr = { ok: false; rid: string; code?: string; message?: string };

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function Chip({ kind, children }: { kind: "ok" | "warn" | "neutral"; children: React.ReactNode }) {
  const cls = kind === "ok" ? "lp-chip lp-chip-ok" : kind === "warn" ? "lp-chip lp-chip-warn" : "lp-chip lp-chip-neutral";
  return <span className={cls}>{children}</span>;
}

function StatusChip({ s }: { s: Person["status"] }) {
  const upper = String(s || "QUEUED").toUpperCase();
  if (upper === "DELIVERED") return <Chip kind="ok">DELIVERED</Chip>;
  if (upper === "PACKED") return <Chip kind="warn">PACKED</Chip>;
  return <Chip kind="neutral">QUEUED</Chip>;
}

function countTotals(windows: WindowGroup[]) {
  let total = 0;
  let queued = 0;
  let packed = 0;
  let delivered = 0;

  for (const w of windows) {
    for (const c of w.companies) {
      for (const l of c.locations) {
        for (const p of l.people) {
          total++;
          const s = String(p.status || "QUEUED").toUpperCase();
          if (s === "DELIVERED") delivered++;
          else if (s === "PACKED") packed++;
          else queued++;
        }
      }
    }
  }
  return { total, queued, packed, delivered };
}

function updatePersonStatus(windows: WindowGroup[], deliveryId: string, status: string): WindowGroup[] {
  const next = JSON.parse(JSON.stringify(windows)) as WindowGroup[];
  for (const w of next) {
    for (const c of w.companies) {
      for (const l of c.locations) {
        const p = l.people.find((x) => x.id === deliveryId);
        if (p) {
          p.status = status;
          return next;
        }
      }
    }
  }
  return windows;
}

function rank(s: string) {
  const u = String(s || "QUEUED").toUpperCase();
  if (u === "DELIVERED") return 2;
  if (u === "PACKED") return 1;
  return 0;
}

export default function NextDeliveryPanel() {
  const [loading, setLoading] = useState(true);
  const [rid, setRid] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [windows, setWindows] = useState<WindowGroup[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // per-delivery action state
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [rowErr, setRowErr] = useState<Record<string, { message: string; rid?: string }>>({});

  async function refetch() {
    const res = await fetch("/api/admin/deliveries?mode=today", { cache: "no-store" });
    const txt = await res.text();
    const json = txt ? JSON.parse(txt) : null;

    if (!json || json.ok !== true) {
      const e = (json as ApiErr) ?? { ok: false, rid: "no-rid", message: "Ukjent feil" };
      setRid(e.rid || "");
      setErr(e.message || "Kunne ikke hente leveringer.");
      setWindows([]);
      return;
    }

    const ok = json as ApiOk;
    setRid(ok.rid || "");
    setDate(ok.date || "");
    setWindows(ok.windows || []);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        await refetch();
      } catch {
        if (!alive) return;
        setErr("Kunne ikke hente leveringer akkurat nå.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const totals = useMemo(() => countTotals(windows), [windows]);

  async function setStatus(deliveryId: string, target: "PACKED" | "DELIVERED") {
    // optimistic: do not downgrade
    const current = (() => {
      for (const w of windows) for (const c of w.companies) for (const l of c.locations) {
        const p = l.people.find((x) => x.id === deliveryId);
        if (p) return String(p.status || "QUEUED").toUpperCase();
      }
      return "QUEUED";
    })();

    if (rank(current) >= rank(target)) return;

    const xrid = `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    setRowErr((prev) => {
      const n = { ...prev };
      delete n[deliveryId];
      return n;
    });
    setRowBusy((prev) => ({ ...prev, [deliveryId]: true }));

    // optimistic UI
    setWindows((prev) => updatePersonStatus(prev, deliveryId, target));

    try {
      const res = await fetch("/api/admin/deliveries/status", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-rid": xrid,
        },
        body: JSON.stringify({ deliveryId, status: target }),
        cache: "no-store",
      });

      const txt = await res.text();
      const json = txt ? JSON.parse(txt) : null;

      if (!json || json.ok !== true) {
        const r = json?.rid || xrid;
        const msg = json?.message || "Kunne ikke oppdatere status.";
        // revert by refetch (truth)
        await refetch();
        setRowErr((prev) => ({ ...prev, [deliveryId]: { message: msg, rid: r } }));
        return;
      }

      // truth update (if backend returns different)
      if (json?.status) {
        setWindows((prev) => updatePersonStatus(prev, deliveryId, String(json.status).toUpperCase()));
      } else {
        await refetch();
      }
    } catch {
      await refetch();
      setRowErr((prev) => ({ ...prev, [deliveryId]: { message: "Nettverksfeil. Prøv igjen.", rid: xrid } }));
    } finally {
      setRowBusy((prev) => ({ ...prev, [deliveryId]: false }));
    }
  }

  return (
    <div className="space-y-3">
      {/* Top summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-neutral-600">Dagens leveringer</span>
          {date ? <span className="lp-chip lp-chip-neutral">{date}</span> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="lp-chip lp-chip-neutral">Totalt: {totals.total}</span>
          <span className="lp-chip lp-chip-neutral">QUEUED: {totals.queued}</span>
          <span className="lp-chip lp-chip-warn">PACKED: {totals.packed}</span>
          <span className="lp-chip lp-chip-ok">DELIVERED: {totals.delivered}</span>
        </div>
      </div>

      {/* Body */}
      <div className="rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
        {loading ? (
          <div className="text-sm lp-muted">Henter leveringer…</div>
        ) : err ? (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-neutral-900">Kunne ikke hente leveringer</div>
            <div className="text-sm lp-muted">{err}</div>
            {rid ? <div className="text-xs text-neutral-500">RID: {rid}</div> : null}
          </div>
        ) : windows.length === 0 ? (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-neutral-900">Ingen leveringer å vise</div>
            <div className="text-sm lp-muted">Det finnes ingen aktive bestillinger for dagen.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {windows.map((w) => (
              <div key={w.windowLabel} className="rounded-2xl bg-white/80 p-4 ring-1 ring-black/10">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-extrabold text-neutral-900">{w.windowLabel}</div>
                  <div className="flex items-center gap-2">
                    <Link href="/kitchen" className="lp-btn lp-btn--secondary lp-btn--sm">
                      Åpne kjøkken
                    </Link>
                    <Link href="/kitchen/print" className="lp-btn lp-btn--ghost lp-btn--sm">
                      Print
                    </Link>
                  </div>
                </div>

                <div className="space-y-3">
                  {w.companies.map((c) => (
                    <div key={c.companyId} className="rounded-xl bg-neutral-50/60 p-3 ring-1 ring-black/5">
                      <div className="text-sm font-semibold text-neutral-900">{c.companyName}</div>

                      <div className="mt-2 space-y-2">
                        {c.locations.map((l) => (
                          <div key={l.locationId} className="rounded-xl bg-white/70 p-3 ring-1 ring-black/5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-neutral-900">{l.locationName}</div>
                                {l.address ? <div className="text-xs text-neutral-500">{l.address}</div> : null}
                              </div>
                              <span className="lp-chip lp-chip-neutral">{l.people.length} stk</span>
                            </div>

                            <div className="mt-3 divide-y divide-black/5">
                              {l.people.map((p) => {
                                const s = String(p.status || "QUEUED").toUpperCase();
                                const busy = !!rowBusy[p.id];
                                const delivered = s === "DELIVERED";
                                const packedOrMore = rank(s) >= 1;

                                return (
                                  <div key={p.id} className="py-2 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <div className="text-sm font-semibold text-neutral-900">{p.name}</div>
                                        <StatusChip s={p.status} />
                                        {busy ? <span className="lp-chip lp-chip-neutral">Oppdaterer…</span> : null}
                                      </div>

                                      <div className="mt-1 text-xs text-neutral-500">
                                        {p.department ? <span>{p.department}</span> : null}
                                        {p.department && p.email ? <span> • </span> : null}
                                        {p.email ? <span className="truncate">{p.email}</span> : null}
                                      </div>

                                      {p.note ? (
                                        <div className="mt-1 text-xs text-neutral-600 lp-wrap-anywhere">
                                          Notat: {p.note}
                                        </div>
                                      ) : null}

                                      {rowErr[p.id] ? (
                                        <div className="mt-2 text-xs text-rose-700">
                                          {rowErr[p.id].message}
                                          {rowErr[p.id].rid ? (
                                            <span className="text-neutral-500"> • RID: {rowErr[p.id].rid}</span>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="shrink-0 flex items-center gap-2">
                                      <button
                                        className="lp-btn lp-btn--ghost lp-btn--sm"
                                        onClick={() => setStatus(p.id, "PACKED")}
                                        disabled={busy || delivered || packedOrMore}
                                        aria-disabled={busy || delivered || packedOrMore}
                                      >
                                        Marker PACKED
                                      </button>
                                      <button
                                        className="lp-btn lp-btn--secondary lp-btn--sm lp-neon-focus lp-neon-glow-hover"
                                        onClick={() => setStatus(p.id, "DELIVERED")}
                                        disabled={busy || delivered}
                                        aria-disabled={busy || delivered}
                                      >
                                        Marker DELIVERED
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-neutral-500">
        Cut-off: kl. 08:00 (Europe/Oslo). Systemet viser alltid verifisert lagret status.
      </div>
    </div>
  );
}

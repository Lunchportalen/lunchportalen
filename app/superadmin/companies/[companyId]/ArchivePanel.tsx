// app/superadmin/companies/[companyId]/ArchivePanel.tsx
"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDateTimeNO } from "@/lib/date/format";

type ApiErr = { ok: false; rid?: string; error: string; message?: string; status?: number; detail?: any };

type OrdersOk = {
  ok: true;
  rid: string;
  data: {
    items: Array<{
      id: string;
      date: string | null;
      status: string | null;
      slot: string | null;
      created_at: string | null;
      user_id: string | null;
      employee_label: string | null;
      note: string | null;
      unit_price: number | null;
      currency: string | null;
    }>;
    count: number;
    sum: number | null;
    warning: string | null;
    currency: string | null;
    page: number;
    limit: number;
    range: { from: string; to: string };
    status: string;
  };
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function fmtTs(ts?: string | null) {
  if (!ts) return "—";
  try {
    return formatDateTimeNO(ts);
  } catch {
    return String(ts);
  }
}

function readJsonSafe(t: string) {
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function isoTodayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function looksLikeConfirm(v: string) {
  return /^\d{9}\s+SLETT$/.test(v);
}

export default function ArchivePanel(props: {
  companyId: string;
  companyName: string | null;
  companyOrgnr: string | null;
  companyStatus: string | null;
  companyDeletedAt: string | null;
}) {
  const { companyId, companyOrgnr, companyDeletedAt } = props;
  const router = useRouter();

  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [archiving, startTransition] = useTransition();
  const [archiveErr, setArchiveErr] = useState<ApiErr | null>(null);
  const [archiveOk, setArchiveOk] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoring, startRestore] = useTransition();
  const [restoreErr, setRestoreErr] = useState<ApiErr | null>(null);
  const [restoreOk, setRestoreOk] = useState<string | null>(null);

  const [orders, setOrders] = useState<OrdersOk["data"] | null>(null);
  const [ordersErr, setOrdersErr] = useState<ApiErr | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [fromDate, setFromDate] = useState<string>(isoDaysAgo(90));
  const [toDate, setToDate] = useState<string>(isoTodayLocal());
  const [status, setStatus] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);

  const isArchived = Boolean(companyDeletedAt);

  const expectedConfirm = companyOrgnr ? `${companyOrgnr} SLETT` : "";
  const restoreConfirmOk = safeStr(restoreConfirm) === "GJENOPPRETT";

  const canConfirm = useMemo(() => {
    if (!companyOrgnr) return false;
    const v = safeStr(confirmText);
    if (!looksLikeConfirm(v)) return false;
    return v === expectedConfirm;
  }, [confirmText, companyOrgnr, expectedConfirm]);

  const loadOrders = useCallback(async (next?: { page?: number; limit?: number }) => {
    setOrdersLoading(true);
    setOrdersErr(null);

    try {
      const p = new URLSearchParams();
      if (fromDate) p.set("from", fromDate);
      if (toDate) p.set("to", toDate);
      if (status) p.set("status", status);
      p.set("page", String(next?.page ?? page));
      p.set("limit", String(next?.limit ?? limit));

      const res = await fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}/orders?${p.toString()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const body = readJsonSafe(await res.text());
      if (!res.ok || !body?.ok) {
        setOrders(null);
        setOrdersErr((body as ApiErr) ?? { ok: false, error: "HTTP_ERROR", message: `HTTP ${res.status}` });
        return;
      }
      setOrders((body as OrdersOk).data ?? null);
    } catch (e: any) {
      setOrders(null);
      setOrdersErr({ ok: false, error: "FETCH_FAILED", message: e?.message || "Kunne ikke hente ordre" });
    } finally {
      setOrdersLoading(false);
    }
  }, [companyId, fromDate, limit, page, status, toDate]);

  function doArchive() {
    if (!canConfirm) return;

    setArchiveErr(null);
    setArchiveOk(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}/archive`, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          body: JSON.stringify({ confirm: safeStr(confirmText), reason: safeStr(reason) || null }),
        });

        const body = readJsonSafe(await res.text());
        if (!res.ok || !body?.ok) {
          setArchiveErr((body as ApiErr) ?? { ok: false, error: "HTTP_ERROR", message: `HTTP ${res.status}` });
          return;
        }

        const already = Boolean(body?.data?.alreadyArchived);
        setArchiveOk(already ? "Firma er allerede arkivert." : "Firma er arkivert. All tilgang er fjernet.");
        setArchiveErr(null);
        router.replace("/superadmin/companies?archived=1");
        router.refresh();
      } catch (e: any) {
        setArchiveErr({ ok: false, error: "ARCHIVE_FAILED", message: e?.message || "Kunne ikke arkivere firma." });
      }
    });
  }

  function doRestore() {
    if (!restoreConfirmOk) return;

    setRestoreErr(null);
    setRestoreOk(null);

    startRestore(async () => {
      try {
        const res = await fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}/restore`, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          body: JSON.stringify({ confirm: "GJENOPPRETT" }),
        });

        const body = readJsonSafe(await res.text());
        if (!res.ok || !body?.ok) {
          setRestoreErr((body as ApiErr) ?? { ok: false, error: "HTTP_ERROR", message: `HTTP ${res.status}` });
          return;
        }

        setRestoreOk("Firma er gjenopprettet. Ny onboarding kreves.");
        setRestoreErr(null);
        router.replace(`/superadmin/companies/${encodeURIComponent(companyId)}`);
        router.refresh();
      } catch (e: any) {
        setRestoreErr({ ok: false, error: "RESTORE_FAILED", message: e?.message || "Kunne ikke gjenopprette firma." });
      }
    });
  }

  useEffect(() => {
    if (!isArchived) return;
    void loadOrders();
  }, [isArchived, loadOrders]);

  const totalPages = orders ? Math.max(1, Math.ceil(orders.count / Math.max(1, orders.limit))) : 1;
  const canPrev = page > 1;
  const canNext = orders ? page < totalPages : false;

  return (
    <section className="mt-6 grid gap-4">
      <div className="rounded-3xl border border-red-200/70 bg-red-50/40 p-5">
        <div className="text-sm font-semibold text-red-900">Danger Zone – Arkiver firma</div>
        <div className="mt-2 text-sm text-red-800">
          Fjerner all tilgang og flytter firma til Slettet (Arkiv). Historikk beholdes.
        </div>

        {!companyOrgnr ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Firma mangler org.nr og kan ikke arkiveres.
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs text-red-800">Bekreft</label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expectedConfirm || "928038777 SLETT"}
              className="mt-1 w-full rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-red-800">Årsak (valgfritt)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Kort årsak…"
              className="mt-1 w-full rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        {archiveErr ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {archiveErr.message || "Kunne ikke arkivere firma."}
            {archiveErr.rid ? <span className="ml-2 text-xs">rid: {archiveErr.rid}</span> : null}
          </div>
        ) : null}
        {archiveOk ? (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {archiveOk}
          </div>
        ) : null}

        <div className="mt-4">
          <button
            className="rounded-full bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            onClick={doArchive}
            disabled={!canConfirm || archiving}
          >
            {archiving ? "Arkiverer…" : "Arkiver firma"}
          </button>
        </div>
      </div>

      {isArchived ? (
        <div className="rounded-3xl border border-amber-200/70 bg-amber-50/40 p-4 text-sm text-amber-900">
          Firma er arkivert – kun historikk. Arkivert {fmtTs(companyDeletedAt)}.
        </div>
      ) : null}

      {isArchived ? (
        <div className="rounded-3xl border border-emerald-200/70 bg-emerald-50/40 p-5">
          <div className="text-sm font-semibold text-emerald-900">Gjenopprett firma</div>
          <div className="mt-2 text-sm text-emerald-900">
            Firma gjenopprettes uten brukere. Ny onboarding kreves.
          </div>

          <div className="mt-4 max-w-sm">
            <label className="block text-xs text-emerald-900">Bekreft</label>
            <input
              value={restoreConfirm}
              onChange={(e) => setRestoreConfirm(e.target.value)}
              placeholder="GJENOPPRETT"
              className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          {restoreErr ? (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-white p-3 text-sm text-emerald-900">
              {restoreErr.message || "Kunne ikke gjenopprette firma."}
              {restoreErr.rid ? <span className="ml-2 text-xs">rid: {restoreErr.rid}</span> : null}
            </div>
          ) : null}
          {restoreOk ? (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-white p-3 text-sm text-emerald-900">
              {restoreOk}
            </div>
          ) : null}

          <div className="mt-4">
            <button
              className="rounded-full bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
              onClick={doRestore}
              disabled={!restoreConfirmOk || restoring}
            >
              {restoring ? "Gjenoppretter…" : "Gjenopprett firma"}
            </button>
          </div>
        </div>
      ) : null}

      {isArchived ? (
        <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Økonomi (historikk)</div>
          <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Beregnet på ordre i valgt periode.</div>

          {ordersLoading ? <div className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Laster…</div> : null}

          {ordersErr ? (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {ordersErr.message || "Kunne ikke hente ordre."}
              {ordersErr.rid ? <span className="ml-2 text-xs">rid: {ordersErr.rid}</span> : null}
            </div>
          ) : null}

          {!ordersErr && !ordersLoading && orders ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs text-[rgb(var(--lp-muted))]">Antall ordre</div>
                <div className="mt-1 text-lg font-semibold">{orders.count}</div>
              </div>
              <div>
                <div className="text-xs text-[rgb(var(--lp-muted))]">Sum</div>
                <div className="mt-1 text-lg font-semibold">
                  {Number.isFinite(Number(orders.sum)) ? `${Number(orders.sum)} ${orders.currency ?? ""}` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-[rgb(var(--lp-muted))]">Periode</div>
                <div className="mt-1 text-sm font-semibold">
                  {orders.range.from} – {orders.range.to}
                </div>
              </div>
              {orders.warning ? (
                <div className="md:col-span-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {orders.warning}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {isArchived ? (
        <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">Bestillinger</div>
          <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Historikk for arkivert firma (readonly).</div>

          <div className="mt-4 flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-[rgb(var(--lp-muted))]">Fra</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setPage(1);
                  setFromDate(e.target.value);
                }}
                className="mt-1 rounded-2xl border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[rgb(var(--lp-muted))]">Til</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setPage(1);
                  setToDate(e.target.value);
                }}
                className="mt-1 rounded-2xl border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[rgb(var(--lp-muted))]">Status</label>
              <select
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value);
                }}
                className="mt-1 rounded-2xl border bg-white px-3 py-2 text-sm"
              >
                <option value="ALL">Alle</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[rgb(var(--lp-muted))]">Limit</label>
              <select
                value={String(limit)}
                onChange={(e) => {
                  setPage(1);
                  setLimit(Number(e.target.value));
                }}
                className="mt-1 rounded-2xl border bg-white px-3 py-2 text-sm"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          {ordersErr ? (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {ordersErr.message || "Kunne ikke hente ordre."}
              {ordersErr.rid ? <span className="ml-2 text-xs">rid: {ordersErr.rid}</span> : null}
            </div>
          ) : null}

          {!ordersErr && ordersLoading ? <div className="mt-3 text-sm text-[rgb(var(--lp-muted))]">Laster…</div> : null}

          {!ordersErr && !ordersLoading && orders ? (
            <div className="mt-4">
              {orders.items.length === 0 ? (
                <div className="text-sm text-[rgb(var(--lp-muted))]">Ingen ordre i valgt periode.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="text-xs text-[rgb(var(--lp-muted))]">
                      <tr className="border-b border-[rgb(var(--lp-border))]">
                        <th className="px-3 py-2">Dato</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Slot</th>
                        <th className="px-3 py-2">Ansatt</th>
                        <th className="px-3 py-2">Note</th>
                        <th className="px-3 py-2">OrderId</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.items.map((o) => (
                        <tr key={o.id} className="border-b border-[rgb(var(--lp-border))]">
                          <td className="px-3 py-2 whitespace-nowrap">{o.date ?? "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{o.status ?? "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{o.slot ?? "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{o.employee_label ?? "—"}</td>
                          <td className="px-3 py-2">{o.note ?? "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{o.id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Totalt: {orders.count}</div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-2xl border bg-white px-3 py-2 text-xs disabled:opacity-40"
                    disabled={!canPrev || ordersLoading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Forrige
                  </button>
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs ring-1 ring-[rgb(var(--lp-border))]">
                    Side {page} / {totalPages}
                  </span>
                  <button
                    className="rounded-2xl border bg-white px-3 py-2 text-xs disabled:opacity-40"
                    disabled={!canNext || ordersLoading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Neste
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}


// components/orders/OrderActions.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type OrderApiResponse = {
  ok: boolean;
  rid: string;

  date: string;
  dateNO: string;

  locked: boolean;
  cutoffTime: string;
  menuAvailable: boolean;
  canAct: boolean;

  error: string | null;
  message: string | null;

  receipt: any | null;
  order: any | null;
};

type UiState = "idle" | "loading" | "posting" | "deleting" | "refreshing";

function niceMessage(res: OrderApiResponse | null) {
  if (!res) return null;
  if (res.ok) return null;
  return res.message || "Handlingen kunne ikke utføres.";
}

function isActiveOrder(res: OrderApiResponse | null) {
  const status = String(res?.order?.status ?? "").toLowerCase();
  return status === "active";
}

export default function OrderActions() {
  const [state, setState] = useState<UiState>("loading");
  const [res, setRes] = useState<OrderApiResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ----- derived -----
  const canAct = !!res?.canAct;
  const menuAvailable = !!res?.menuAvailable;
  const locked = !!res?.locked;
  const cutoffTime = res?.cutoffTime ?? "08:00";

  const hasActiveOrder = useMemo(() => isActiveOrder(res), [res]);

  const dateLabel = res?.dateNO ?? res?.date ?? "";
  const banner = err ?? niceMessage(res);

  async function load(mode: "initial" | "refresh" | "silent" = "refresh") {
    if (mode === "initial") setState("loading");
    else if (mode === "refresh") setState("refreshing");
    setErr(null);

    try {
      const r = await fetch("/api/orders/today", { cache: "no-store" });
      const j = (await r.json()) as OrderApiResponse;

      setRes(j ?? null);

      if (!r.ok || !j?.ok) {
        setErr(j?.message ?? `Feil ved henting (HTTP ${r.status}).`);
        return;
      }
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke hente bestillingsstatus.");
      setRes(null);
    } finally {
      if (mode !== "silent") setState("idle");
    }
  }

  async function placeOrder() {
    setState("posting");
    setErr(null);

    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ note: "" }),
      });

      const j = (await r.json()) as OrderApiResponse;
      setRes(j ?? null);

      if (!r.ok || !j?.ok) {
        setErr(j?.message ?? `Kunne ikke bestille (HTTP ${r.status}).`);
        return;
      }

      // Synk UI mot status-endpoint (idempotent, DB er fasit)
      await load("silent");
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke registrere bestilling.");
    } finally {
      setState("idle");
    }
  }

  async function cancelOrder() {
    setState("deleting");
    setErr(null);

    try {
      const r = await fetch("/api/orders", {
        method: "DELETE",
        cache: "no-store",
      });

      const j = (await r.json()) as OrderApiResponse;
      setRes(j ?? null);

      if (!r.ok || !j?.ok) {
        setErr(j?.message ?? `Kunne ikke avbestille (HTTP ${r.status}).`);
        return;
      }

      await load("silent");
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke avbestille.");
    } finally {
      setState("idle");
    }
  }

  useEffect(() => {
    load("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBusy = state === "loading" || state === "posting" || state === "deleting" || state === "refreshing";

  // Knappereglene (fasit)
  const canPlace = !isBusy && menuAvailable && canAct && !hasActiveOrder;
  const canCancel = !isBusy && canAct && hasActiveOrder;

  const statusText = hasActiveOrder ? "Bestilt" : "Ikke bestilt";

  return (
    <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm opacity-70">Lunsj i dag</div>
          <div className="text-lg font-semibold">{dateLabel || "—"}</div>
        </div>

        <button
          type="button"
          onClick={() => load("refresh")}
          disabled={isBusy}
          className="rounded-full px-3 py-1.5 text-xs ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/60 disabled:opacity-60"
        >
          {state === "refreshing" ? "Oppdaterer…" : "Oppdater"}
        </button>
      </div>

      {/* Status */}
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="opacity-70">Meny</span>
          <span className="font-medium">{menuAvailable ? "Publisert" : "Ikke publisert"}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="opacity-70">Cutoff</span>
          <span className="font-medium">{cutoffTime}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="opacity-70">Status</span>
          <span className="font-medium">
            {statusText}
            {locked ? " • Låst" : ""}
          </span>
        </div>
      </div>

      {/* Banner */}
      {banner ? (
        <div className="mt-3 rounded-xl bg-white/60 p-3 text-sm ring-1 ring-[rgb(var(--lp-border))]">
          {banner}
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={placeOrder}
          disabled={!canPlace}
          className={[
            "rounded-xl px-4 py-2 text-sm font-medium ring-1 transition",
            canPlace
              ? "bg-black text-white ring-black"
              : "bg-white/60 text-[rgb(var(--lp-muted))] ring-[rgb(var(--lp-border))] opacity-70",
          ].join(" ")}
        >
          {state === "posting" ? "Bestiller…" : "Bestill lunsj"}
        </button>

        <button
          type="button"
          onClick={cancelOrder}
          disabled={!canCancel}
          className={[
            "rounded-xl px-4 py-2 text-sm font-medium ring-1 transition",
            canCancel
              ? "bg-white/60 ring-[rgb(var(--lp-border))] hover:bg-white"
              : "bg-white/60 text-[rgb(var(--lp-muted))] ring-[rgb(var(--lp-border))] opacity-70",
          ].join(" ")}
        >
          {state === "deleting" ? "Avbestiller…" : "Avbestill"}
        </button>
      </div>

      {/* Forklaringer */}
      {!canAct ? (
        <div className="mt-3 text-xs opacity-70">
          Endringer er sperret etter kl. {cutoffTime}.
        </div>
      ) : null}

      {!menuAvailable ? (
        <div className="mt-2 text-xs opacity-70">
          Menyen er ikke publisert ennå – du kan ikke bestille før den er tilgjengelig.
        </div>
      ) : null}
    </div>
  );
}

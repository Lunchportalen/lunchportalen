"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type OrderRow = {
  id: string;
  date: string;
  status: "active" | "canceled";
  note: string | null;
  updated_at: string;
};

type TodayState = {
  ok: boolean;
  date: string;
  locked: boolean;
  cutoffTime: string;
  menuAvailable: boolean;
  order: OrderRow | null;
  error?: string;
};

export default function TodayClient(props: {
  dateISO: string;
  cutoffLocked: boolean;
  menuAvailable: boolean;
}) {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<TodayState | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/today", { cache: "no-store" });
      const json = (await res.json()) as TodayState;
      setState(json);
      setNote(json?.order?.note || "");
    } catch {
      setMsg("Kunne ikke hente status. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const effectiveLocked = state?.ok ? state.locked : props.cutoffLocked;
  const effectiveMenu = state?.ok ? state.menuAvailable : props.menuAvailable;
  const canAct = !effectiveLocked && effectiveMenu;

  const orderActive = state?.ok && state.order?.status === "active";

  async function placeOrUpdate() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        const e = json?.error || "Ukjent feil";
        if (e === "LOCKED_AFTER_0800")
          setMsg("Det er låst etter 08:00. Endringer kan ikke gjøres nå.");
        else if (e === "MENU_NOT_PUBLISHED")
          setMsg("Meny er ikke publisert. Bestilling er ikke tilgjengelig.");
        else setMsg("Kunne ikke registrere bestilling. Prøv igjen.");
        return;
      }

      setMsg("Bestilling registrert.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/order", { method: "DELETE" });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        const e = json?.error || "Ukjent feil";
        if (e === "LOCKED_AFTER_0800")
          setMsg("Det er låst etter 08:00. Endringer kan ikke gjøres nå.");
        else setMsg("Kunne ikke avbestille. Prøv igjen.");
        return;
      }

      setMsg("Bestilling avbestilt.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setMsg(null);
    try {
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      setMsg("Kunne ikke logge ut. Prøv igjen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-white/15 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-sm opacity-70">Din bestilling</div>

        <button
          className="rounded-lg border border-white/15 px-3 py-1 text-xs opacity-80 hover:bg-white/5"
          onClick={logout}
          disabled={busy}
          title="Logg ut"
        >
          Logg ut
        </button>
      </div>

      {loading ? (
        <div className="mt-2 text-sm opacity-70">Henter status…</div>
      ) : state?.ok ? (
        state.order?.status === "active" ? (
          <div className="mt-2 text-sm">
            <span className="opacity-70">Status:</span>{" "}
            <span className="font-medium">Registrert</span>
          </div>
        ) : (
          <div className="mt-2 text-sm opacity-70">Ingen aktiv bestilling registrert.</div>
        )
      ) : (
        <div className="mt-2 text-sm opacity-70">Kunne ikke hente status.</div>
      )}

      <div className="mt-4">
        <label className="block text-sm opacity-70">Kommentar (valgfritt)</label>
        <input
          className="mt-2 w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm outline-none"
          placeholder="F.eks. uten løk / glutenfri hvis mulig"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={!canAct || busy}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="rounded-lg border border-white/15 px-4 py-2 text-sm"
          onClick={placeOrUpdate}
          disabled={!canAct || busy}
        >
          {orderActive ? "Oppdater bestilling" : "Bestill"}
        </button>

        <button
          className="rounded-lg border border-white/15 px-4 py-2 text-sm opacity-90"
          onClick={cancel}
          disabled={!canAct || busy || !orderActive}
        >
          Avbestill
        </button>

        <button
          className="rounded-lg border border-white/15 px-4 py-2 text-sm opacity-70"
          onClick={refresh}
          disabled={busy}
        >
          Oppdater
        </button>
      </div>

      <div className="mt-3 text-xs opacity-70">
        Endringer kan gjøres frem til kl. 08:00 samme dag (Trondheim).
      </div>

      {effectiveLocked && (
        <div className="mt-2 text-xs opacity-70">
          Det er låst etter 08:00 – endringer er deaktivert.
        </div>
      )}
      {!effectiveMenu && (
        <div className="mt-2 text-xs opacity-70">
          Meny er ikke publisert – bestilling er deaktivert.
        </div>
      )}

      {msg && <div className="mt-3 text-sm">{msg}</div>}
    </section>
  );
}

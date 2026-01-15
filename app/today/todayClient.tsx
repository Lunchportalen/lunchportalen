"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type OrderRow = {
  id: string;
  date: string; // YYYY-MM-DD
  status: "active" | "canceled";
  note: string | null;
  created_at: string; // kvittering (registrert)
  updated_at: string; // kvittering (avbestilt / oppdatert)
};

type TodayState = {
  ok: boolean;
  date: string; // YYYY-MM-DD
  locked: boolean;
  cutoffTime: string; // "08:00"
  menuAvailable: boolean;
  canAct?: boolean; // ✅ fra /api/today (ny)
  reason?: string; // ✅ f.eks. PROFILE_MISSING_SCOPE
  message?: string; // ✅ brukervennlig tekst fra API
  rid?: string;
  order: OrderRow | null;
  error?: string;
  detail?: string;
};

function formatOslo(ts?: string | null) {
  if (!ts) return "";
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      timeZone: "Europe/Oslo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return ts || "";
  }
}

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

      // Hvis API gir en “forklaring”, bruk den som mild info (ikke som error)
      if (json?.message) setMsg(json.message);
    } catch {
      setMsg("Kunne ikke hente status. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Fallback hvis API ikke har canAct ennå
  const effectiveLocked = state?.ok ? state.locked : props.cutoffLocked;
  const effectiveMenu = state?.ok ? state.menuAvailable : props.menuAvailable;

  const canAct =
    state?.ok && typeof state.canAct === "boolean"
      ? state.canAct
      : !effectiveLocked && effectiveMenu;

  const hasOrder = !!(state?.ok && state.order);
  const orderActive = state?.ok && state.order?.status === "active";

  // Kvittering: registrert = created_at, avbestilt = updated_at
  const receiptLabel = orderActive ? "✅ Registrert" : hasOrder ? "❌ Avbestilt" : null;
  const receiptTime = orderActive ? state?.order?.created_at : state?.order?.updated_at;

  async function placeOrUpdate() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        const e = json?.error || "Ukjent feil";

        if (e === "LOCKED_AFTER_0800")
          setMsg("Det er låst etter 08:00. Endringer kan ikke gjøres nå.");
        else if (e === "MENU_NOT_PUBLISHED")
          setMsg("Meny er ikke publisert. Bestilling er ikke tilgjengelig.");
        else if (e === "PROFILE_MISSING_SCOPE")
          setMsg(
            "Kontoen din mangler firmatilknytning/leveringssted. Ta kontakt med admin for å bli lagt til."
          );
        else if (json?.message) setMsg(json.message);
        else setMsg("Kunne ikke registrere bestilling. Prøv igjen.");

        return;
      }

      setMsg(orderActive ? "Bestilling oppdatert." : "Bestilling registrert.");
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
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        const e = json?.error || "Ukjent feil";

        if (e === "LOCKED_AFTER_0800")
          setMsg("Det er låst etter 08:00. Endringer kan ikke gjøres nå.");
        else if (e === "PROFILE_MISSING_SCOPE")
          setMsg(
            "Kontoen din mangler firmatilknytning/leveringssted. Ta kontakt med admin for å bli lagt til."
          );
        else if (json?.message) setMsg(json.message);
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

        <div className="flex items-center gap-2">
          <a
            href="/week"
            className="rounded-lg border border-white/15 px-3 py-1 text-xs opacity-80 hover:bg-white/5"
            title="Ukemeny (Man–Fre)"
          >
            Ukemeny
          </a>

          <button
            className="rounded-lg border border-white/15 px-3 py-1 text-xs opacity-80 hover:bg-white/5"
            onClick={logout}
            disabled={busy}
            title="Logg ut"
          >
            Logg ut
          </button>
        </div>
      </div>

      {/* Status + kvittering */}
      {loading ? (
        <div className="mt-2 text-sm opacity-70">Henter status…</div>
      ) : state?.ok ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
          {!state.order ? (
            <>
              <div className="text-sm opacity-80">Ingen registrering for i dag.</div>

              {state?.reason === "PROFILE_MISSING_SCOPE" ? (
                <div className="mt-1 text-xs opacity-70">
                  Kontoen din mangler firmatilknytning/leveringssted. Ta kontakt med admin for å bli lagt til.
                </div>
              ) : (
                <div className="mt-1 text-xs opacity-70">
                  Du kan bestille frem til kl. {state.cutoffTime || "08:00"} (Trondheim).
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-sm font-medium">{receiptLabel}</div>

              <div className="mt-1 text-sm opacity-80">
                Status:{" "}
                <span className="font-medium">
                  {state.order.status === "active" ? "Aktiv" : "Avbestilt"}
                </span>
              </div>

              {receiptTime && (
                <div className="mt-1 text-sm opacity-80">
                  Tidspunkt: <span className="font-medium">{formatOslo(receiptTime)}</span>
                </div>
              )}

              {state.order.note ? (
                <div className="mt-2 text-xs opacity-70">
                  Kommentar: <span className="opacity-90">{state.order.note}</span>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="mt-2 text-sm opacity-70">
          Kunne ikke hente status{state?.rid ? ` (ref: ${state.rid})` : ""}.
        </div>
      )}

      {/* Kommentar */}
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

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="rounded-lg border border-white/15 px-4 py-2 text-sm"
          onClick={placeOrUpdate}
          disabled={!canAct || busy}
        >
          {orderActive ? "Oppdater" : "Bestill lunsj"}
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

      {/* Guardrails */}
      <div className="mt-3 text-xs opacity-70">
        Endringer kan gjøres frem til kl. {state?.cutoffTime || "08:00"} samme dag (Trondheim).
      </div>

      {effectiveLocked && (
        <div className="mt-2 text-xs opacity-70">
          Det er låst etter {state?.cutoffTime || "08:00"} – endringer er deaktivert.
        </div>
      )}
      {!effectiveMenu && (
        <div className="mt-2 text-xs opacity-70">
          Meny er ikke publisert – bestilling er deaktivert.
        </div>
      )}

      {/* ✅ Påkrevd helge-CTA */}
      <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-medium">Helgelevering (lørdag/søndag)</div>
        <div className="mt-1 text-sm opacity-80">
          Levering i helg bestilles ikke i Lunchportalen.
        </div>
        <a
          href="https://melhuscatering.no/catering/bestill-her/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
        >
          Bestill helgelevering
        </a>
      </div>

      {msg && <div className="mt-3 text-sm">{msg}</div>}
    </section>
  );
}

// app/admin/menus/MenusClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DayStatus = "published" | "unpublished" | "missing";

type MenuDay = {
  date: string; // YYYY-MM-DD
  weekday: string; // Man/Tir/...
  title?: string | null;
  description?: string | null;
  allergens?: string[] | null;
  status: DayStatus;
};

type WeekResp = {
  week: string; // YYYY-Www
  days: MenuDay[];
};

type ApiOk = { ok: true; rid?: string; week: WeekResp };
type ApiErr = { ok: false; rid?: string; error: string; message?: string; detail?: any };
type ApiRes = ApiOk | ApiErr;

function isErr(v: any): v is ApiErr {
  return !!v && v.ok === false;
}

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : "—";
}

function statusChipClass(status: DayStatus) {
  if (status === "published") return "lp-chip lp-chip-ok";
  if (status === "missing") return "lp-chip lp-chip-warn";
  return "lp-chip lp-chip-neutral";
}

function statusLabel(status: DayStatus) {
  if (status === "published") return "Publisert";
  if (status === "missing") return "Mangler innhold";
  return "Ikke publisert";
}

export default function MenusClient() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [data, setData] = useState<WeekResp | null>(null);

  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);

  const [publishing, setPublishing] = useState<string | null>(null); // date | "ALL" | null
  const abortRef = useRef<AbortController | null>(null);

  async function load() {
    setState("loading");
    setErrMsg(null);
    setRid(null);

    // Avbryt forrige request (enterprise: ingen “race conditions”)
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const r = await fetch(`/api/superadmin/menus-week?offset=${weekOffset}`, {
        cache: "no-store",
        signal: ac.signal,
      });

      const j = (await r.json().catch(() => null)) as ApiRes | null;

      if (!r.ok || !j) {
        setState("error");
        setErrMsg(`Kunne ikke hente meny (HTTP ${r.status})`);
        return;
      }

      if (isErr(j)) {
        setState("error");
        setRid(j.rid ?? null);
        setErrMsg(j.message ?? j.error ?? "Kunne ikke hente meny");
        return;
      }

      setData(j.week);
      setRid(j.rid ?? null);
      setState("ready");
    } catch (e: any) {
      if (String(e?.name ?? "") === "AbortError") return;
      setState("error");
      setErrMsg("Kunne ikke laste meny (nettverksfeil).");
    }
  }

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  const canPublishAll = useMemo(() => {
    if (!data) return false;
    return data.days.every((d) => d.status !== "missing");
  }, [data]);

  const hasUnpublished = useMemo(() => {
    if (!data) return false;
    return data.days.some((d) => d.status === "unpublished");
  }, [data]);

  async function setPublish(date: string, publish: boolean) {
    setErrMsg(null);
    setRid(null);
    setPublishing(date);

    try {
      const r = await fetch("/api/superadmin/menu-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ date, publish }),
      });

      const j = (await r.json().catch(() => null)) as any;

      if (!r.ok || !j) {
        setErrMsg(`Kunne ikke oppdatere publisering (HTTP ${r.status})`);
        return;
      }

      if (j.ok === false) {
        setRid(j.rid ?? null);
        setErrMsg(j.message ?? j.error ?? "Kunne ikke oppdatere publisering");
        return;
      }

      // Refresh etter vellykket endring
      await load();
    } catch {
      setErrMsg("Kunne ikke oppdatere publisering (nettverksfeil).");
    } finally {
      setPublishing(null);
    }
  }

  async function publishAllWeek() {
    if (!data) return;
    if (!canPublishAll) return;

    setErrMsg(null);
    setRid(null);
    setPublishing("ALL");

    try {
      // Enterprise: publiser deterministisk i rekkefølge (Man–Fre)
      for (const d of data.days) {
        if (d.status === "missing") continue; // skal ikke skje når canPublishAll=true
        if (d.status !== "published") {
          // eslint-disable-next-line no-await-in-loop
          await setPublish(d.date, true);
        }
      }
      await load();
    } finally {
      setPublishing(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="lp-btn"
          type="button"
          onClick={() => setWeekOffset((v) => v - 1)}
          disabled={state === "loading" || publishing !== null}
        >
          ← Forrige uke
        </button>

        <button
          className="lp-btn"
          type="button"
          onClick={() => setWeekOffset((v) => v + 1)}
          disabled={state === "loading" || publishing !== null}
        >
          Neste uke →
        </button>

        <button
          className="lp-btn"
          type="button"
          onClick={load}
          disabled={state === "loading" || publishing !== null}
        >
          Oppdater
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            className="lp-btn-primary"
            type="button"
            disabled={!data || !canPublishAll || publishing !== null || !hasUnpublished}
            onClick={publishAllWeek}
            title={!canPublishAll ? "Mangler innhold – kan ikke publisere" : undefined}
          >
            {publishing === "ALL" ? "Publiserer…" : "Publiser hele uka"}
          </button>
        </div>
      </div>

      {/* System line */}
      {data ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs text-[rgb(var(--lp-muted))]">
            Uke: <span className="font-mono">{data.week}</span>
          </div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">
            {rid ? (
              <>
                RID: <span className="font-mono">{rid}</span>
              </>
            ) : (
              <>RID: —</>
            )}
          </div>
        </div>
      ) : null}

      {/* Error */}
      {state === "error" ? (
        <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold text-red-700">Kunne ikke laste meny</div>
          <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{errMsg ?? "Ukjent feil"}</div>
          {rid ? (
            <div className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
              RID: <span className="font-mono">{rid}</span>
            </div>
          ) : null}
          <div className="mt-4">
            <button className="lp-btn" type="button" onClick={load}>
              Prøv igjen
            </button>
          </div>
        </div>
      ) : null}

      {/* Loading */}
      {state === "loading" ? (
        <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">Laster meny…</div>
      ) : null}

      {/* Days */}
      {state === "ready" && data ? (
        <div className="divide-y rounded-3xl bg-white ring-1 ring-[rgb(var(--lp-border))]">
          {data.days.map((d) => {
            const disabled = d.status === "missing" || publishing !== null;
            const busy = publishing === d.date;

            return (
              <div
                key={d.date}
                className="flex flex-col gap-2 px-5 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {safeText(d.weekday)} <span className="font-mono">{d.date}</span>
                  </div>

                  <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{safeText(d.title) === "—" ? "— Ingen tittel —" : safeText(d.title)}</div>

                  <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                    {d.allergens?.length ? `Allergener: ${d.allergens.join(", ")}` : "Allergener: —"}
                  </div>

                  {d.status === "missing" ? (
                    <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
                      Mangler innhold (tittel/tekst/allergener). Publisering er sperret.
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={statusChipClass(d.status)}>{statusLabel(d.status)}</span>

                  <button
                    className="lp-btn"
                    type="button"
                    disabled={disabled}
                    onClick={() => setPublish(d.date, d.status !== "published")}
                    title={d.status === "missing" ? "Kan ikke publisere: mangler innhold" : undefined}
                  >
                    {busy ? "Oppdaterer…" : d.status === "published" ? "Avpubliser" : "Publiser"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Rule box */}
      <div className="rounded-3xl bg-[rgb(var(--lp-surface))] p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Regel (låst)</div>
        <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
          Superadmin styrer kun synlighet. Innhold redigeres i Sanity. Mangelfull dag kan aldri publiseres.
        </p>
      </div>
    </div>
  );
}

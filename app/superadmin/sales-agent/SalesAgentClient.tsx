"use client";

import { useCallback, useState } from "react";

import type { SalesChannel, SalesOutreachQueueItem, SalesQueueStatus } from "@/lib/sales/outreachQueueTypes";

type ApiRunOk = {
  ok: true;
  rid: string;
  data: {
    pipelineAvailable: boolean;
    queue: SalesOutreachQueueItem[];
    selectedLeads: unknown[];
    learning: Array<{ dealId: string; winProbability: number; stage: string }>;
    followUp: Array<{ dealId: string; needsFollowUp: boolean }>;
  };
};

type ApiSendOk = {
  ok: true;
  rid: string;
  data: {
    results: SalesOutreachQueueItem[];
    blockedReason: "disabled" | "no_explicit_run_approval" | null;
    killSwitch: boolean;
    sendsToday: number;
  };
};

type UiRow = SalesOutreachQueueItem & {
  localMessage: string;
  localChannel: SalesChannel;
  localEmail: string;
  discarded: boolean;
};

function badgeClass(s: SalesQueueStatus): string {
  switch (s) {
    case "sent":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case "approved":
      return "bg-sky-100 text-sky-900 border-sky-200";
    case "failed":
      return "bg-rose-100 text-rose-900 border-rose-200";
    case "ready_manual":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "draft":
    default:
      return "bg-neutral-100 text-neutral-800 border-neutral-200";
  }
}

function labelStatus(s: SalesQueueStatus): string {
  switch (s) {
    case "draft":
      return "Utkast";
    case "approved":
      return "Godkjent";
    case "sent":
      return "Sendt";
    case "failed":
      return "Feilet";
    case "ready_manual":
      return "LinkedIn (manuell)";
    default:
      return s;
  }
}

export default function SalesAgentClient() {
  const [busy, setBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendNote, setSendNote] = useState<string | null>(null);
  const [rows, setRows] = useState<UiRow[]>([]);
  const [learning, setLearning] = useState<ApiRunOk["data"]["learning"]>([]);
  const [pipelineAvailable, setPipelineAvailable] = useState<boolean | null>(null);
  const [confirmExplicitSend, setConfirmExplicitSend] = useState(false);
  const [sendsToday, setSendsToday] = useState<number | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    setSendNote(null);
    try {
      const idem = `sales-agent-${Date.now().toString(36)}`;
      const res = await fetch("/api/sales/agent/run", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-idempotency-key": idem,
        },
        body: JSON.stringify({ idempotencyKey: idem }),
        cache: "no-store",
      });
      const j = (await res.json()) as ApiRunOk | { ok: false; message?: string };
      if (!res.ok || !("ok" in j) || j.ok !== true || !j.data) {
        setError(typeof (j as { message?: string }).message === "string" ? (j as { message: string }).message : "Kunne ikke kjøre agent.");
        return;
      }
      setPipelineAvailable(j.data.pipelineAvailable);
      setLearning(Array.isArray(j.data.learning) ? j.data.learning : []);
      const q = Array.isArray(j.data.queue) ? j.data.queue : [];
      setRows(
        q.map((item) => ({
          ...item,
          localMessage: item.message,
          localChannel: item.channel,
          localEmail: item.email ?? "",
          discarded: false,
        })),
      );
    } catch {
      setError("Kunne ikke kjøre agent.");
    } finally {
      setBusy(false);
    }
  }, []);

  const approveRow = (id: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "approved",
              approvedAt: Date.now(),
              message: r.localMessage,
              channel: r.localChannel,
              email: r.localEmail.trim() || null,
            }
          : r,
      ),
    );
  };

  const discardRow = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, discarded: true } : r)));
  };

  const setMessage = (id: string, text: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, localMessage: text } : r)));
  };

  const setChannel = (id: string, ch: SalesChannel) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, localChannel: ch } : r)));
  };

  const setEmail = (id: string, v: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, localEmail: v } : r)));
  };

  const sendApproved = useCallback(async () => {
    setSendBusy(true);
    setError(null);
    setSendNote(null);
    try {
      const idem = `sales-send-${Date.now().toString(36)}`;
      const payload: SalesOutreachQueueItem[] = rows
        .filter((r) => !r.discarded)
        .map((r) => ({
          id: r.id,
          dealId: r.dealId,
          company: r.company,
          message: r.localMessage,
          channel: r.localChannel,
          email: r.localEmail.trim() || null,
          status: r.status,
          approvedAt: r.approvedAt,
          sentAt: r.sentAt,
          createdAt: r.createdAt,
        }));

      const res = await fetch("/api/sales/send", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-idempotency-key": idem,
        },
        body: JSON.stringify({
          queue: payload,
          explicitAutoSendApproved: confirmExplicitSend,
          idempotencyKey: idem,
        }),
        cache: "no-store",
      });
      const j = (await res.json()) as ApiSendOk | { ok: false; message?: string };
      if (!res.ok || !("ok" in j) || j.ok !== true || !j.data) {
        setError(typeof (j as { message?: string }).message === "string" ? (j as { message: string }).message : "Utsendelse feilet.");
        return;
      }
      setSendsToday(j.data.sendsToday);
      const results = j.data.results;
      setRows((prev) => {
        const byId = new Map(results.map((x) => [x.id, x]));
        return prev.map((r) => {
          const u = byId.get(r.id);
          if (!u) return r;
          return {
            ...u,
            localMessage: u.message,
            localChannel: u.channel,
            localEmail: u.email ?? "",
            discarded: r.discarded,
          };
        });
      });
      if (j.data.blockedReason === "disabled") {
        setSendNote("Automatisk utsendelse er av (SALES_AUTOSEND_ENABLED er ikke «true»). Ingen meldinger sendt.");
      } else if (j.data.blockedReason === "no_explicit_run_approval") {
        setSendNote("Mangler eksplisitt bekreftelse i UI.");
      } else {
        setSendNote(null);
      }
    } catch {
      setError("Utsendelse feilet.");
    } finally {
      setSendBusy(false);
    }
  }, [rows, confirmExplicitSend]);

  const visible = rows.filter((r) => !r.discarded);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="rounded-full border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Genererer…" : "Generer utkast"}
        </button>
        <p className="text-xs text-[rgb(var(--lp-muted))]">
          Standard: trygg modus — ingen utsendelse før du godkjenner per rad og bekrefter eksplisitt.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {sendNote ? (
        <p className="text-sm text-amber-800" role="status">
          {sendNote}
        </p>
      ) : null}

      {pipelineAvailable === false ? (
        <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen pipeline-data tilgjengelig.</p>
      ) : null}

      {sendsToday != null ? (
        <p className="text-xs text-[rgb(var(--lp-muted))]">E-post sendt i dag (server-teller): {sendsToday}</p>
      ) : null}

      {learning.length > 0 ? (
        <section className="rounded-lg border border-black/10 bg-white/50 p-4">
          <h2 className="text-sm font-semibold text-neutral-900">Valgte leads (innsikt)</h2>
          <ul className="mt-2 space-y-1 text-xs text-neutral-700">
            {learning.map((l) => (
              <li key={l.dealId}>
                {l.dealId.slice(0, 8)}… · {l.stage} · modell {l.winProbability}%
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white/40 p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Utsendelse (kontrollert)</h2>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={confirmExplicitSend}
            onChange={(e) => setConfirmExplicitSend(e.target.checked)}
            className="mt-1"
          />
          <span>
            Jeg bekrefter eksplisitt at godkjente rader kan behandles av server (e-post kun med SMTP + kill switch;
            LinkedIn kun manuelt utkast).
          </span>
        </label>
        <button
          type="button"
          onClick={() => void sendApproved()}
          disabled={sendBusy || !confirmExplicitSend}
          className="self-start rounded-full border border-neutral-900 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-900 hover:text-white disabled:opacity-50"
        >
          {sendBusy ? "Behandler…" : "Kjør utsendelse / LinkedIn-utkast"}
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900">Kø</h2>
        {visible.length === 0 ? (
          <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen rader ennå.</p>
        ) : (
          visible.map((r) => (
            <article key={r.id} className="rounded-lg border border-black/10 bg-white/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-neutral-900">{r.company}</p>
                  <p className="text-xs text-[rgb(var(--lp-muted))]">Deal {r.dealId}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(r.status)}`}>
                  {labelStatus(r.status)}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="block text-xs font-medium text-neutral-700">
                  Kanal
                  <select
                    className="mt-1 w-full rounded-md border border-black/10 bg-white p-2 text-sm"
                    value={r.localChannel}
                    onChange={(e) => setChannel(r.id, e.target.value as SalesChannel)}
                  >
                    <option value="email">E-post</option>
                    <option value="linkedin">LinkedIn (aldri auto-send)</option>
                  </select>
                </label>
                {r.localChannel === "email" ? (
                  <label className="block text-xs font-medium text-neutral-700">
                    Mottaker e-post
                    <input
                      type="email"
                      className="mt-1 w-full rounded-md border border-black/10 bg-white p-2 text-sm"
                      value={r.localEmail}
                      onChange={(e) => setEmail(r.id, e.target.value)}
                      placeholder="navn@bedrift.no"
                      autoComplete="off"
                    />
                  </label>
                ) : (
                  <p className="text-xs text-[rgb(var(--lp-muted))] sm:col-span-1 sm:self-end">
                    LinkedIn: tekst klargjøres som manuelt utkast — ingen API-kall.
                  </p>
                )}
              </div>

              <label className="mt-3 block text-xs font-medium text-neutral-700" htmlFor={`msg-${r.id}`}>
                Melding
              </label>
              <textarea
                id={`msg-${r.id}`}
                className="mt-1 w-full min-h-[120px] rounded-md border border-black/10 bg-white/80 p-2 text-sm text-neutral-900"
                value={r.localMessage}
                onChange={(e) => setMessage(r.id, e.target.value)}
                rows={5}
              />

              {r.linkedinDraft ? (
                <p className="mt-2 text-xs text-neutral-600">
                  {r.linkedinDraft.instruction}: {r.linkedinDraft.text.slice(0, 200)}
                  {r.linkedinDraft.text.length > 200 ? "…" : ""}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                  onClick={() => approveRow(r.id)}
                  disabled={r.status === "sent" || r.status === "ready_manual"}
                >
                  Godkjenn for utsendelse
                </button>
                <button type="button" className="rounded-md border border-neutral-300 px-2 py-1 text-xs" onClick={() => discardRow(r.id)}>
                  Forkast
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

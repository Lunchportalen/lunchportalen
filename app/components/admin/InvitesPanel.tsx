// components/admin/InvitesPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type InviteRow = {
  id: string;
  email: string;
  full_name: string | null;
  department: string | null;
  location_id: string | null;
  created_at: string | null;
  last_sent_at: string | null;
  expires_at: string | null;
  used_at: string | null;
};

type ApiOkList = {
  ok: true;
  invites: InviteRow[];
  total?: number;
  page?: number;
  limit?: number;
};

type ApiOk = { ok: true; message?: string };
type ApiErr = { ok: false; error: string; message?: string; detail?: any };

function fmtTs(ts: string | null | undefined) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("nb-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

async function readJsonOrThrow(res: Response) {
  const text = await res.text();
  if (!text) throw new Error(`Server returnerte tom respons (HTTP ${res.status}).`);
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Server returnerte ikke JSON (HTTP ${res.status}).`);
  }
  return json;
}

function isExpired(r: InviteRow) {
  const exp = r.expires_at ? new Date(r.expires_at).getTime() : NaN;
  return Number.isFinite(exp) ? Date.now() > exp : false;
}

export default function InvitesPanel() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [includeExpired, setIncludeExpired] = useState(false);
  const [includeUsed, setIncludeUsed] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  async function load(opts?: { keepToast?: boolean }) {
    setLoading(true);
    setErr(null);
    if (!opts?.keepToast) setToast(null);

    try {
      const url =
        `/api/admin/employees/invites` +
        `?q=${encodeURIComponent(q.trim())}` +
        `&includeExpired=${includeExpired ? "true" : "false"}` +
        `&includeUsed=${includeUsed ? "true" : "false"}` +
        `&page=1&limit=200`;

      // ✅ IMPORTANT: THIS IS GET (default), NOT POST
      const res = await fetch(url, { headers: { "cache-control": "no-store" } });
      const json = (await readJsonOrThrow(res)) as ApiOkList | ApiErr;

      if (!res.ok || !json || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
      }

      setRows((json as ApiOkList).invites ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke hente invitasjoner.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lokal filtrering (UI), i tillegg til server-q
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const email = String(r.email ?? "").toLowerCase();
      const name = String(r.full_name ?? "").toLowerCase();
      const dept = String(r.department ?? "").toLowerCase();
      return email.includes(needle) || name.includes(needle) || dept.includes(needle);
    });
  }, [rows, q]);

  function statusChip(r: InviteRow) {
    if (r.used_at) return { label: "Brukt", cls: "bg-white ring-1 ring-[rgb(var(--lp-border))]" };
    if (isExpired(r)) return { label: "Utløpt", cls: "bg-white ring-1 ring-[rgb(var(--lp-border))]" };
    return { label: "Aktiv", cls: "bg-white ring-1 ring-[rgb(var(--lp-border))]" };
  }

  async function resend(inviteId: string) {
    setBusyId(inviteId);
    setToast(null);

    try {
      const res = await fetch("/api/admin/employees/invites/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });

      const json = (await readJsonOrThrow(res)) as ApiOk | ApiErr;
      if (!res.ok || !json || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
      }

      setToast({ ok: true, msg: (json as ApiOk).message || "Invitasjon sendt på nytt." });
      await load({ keepToast: true });
    } catch (e: any) {
      setToast({ ok: false, msg: e?.message ?? "Kunne ikke sende på nytt." });
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(inviteId: string) {
    if (!confirm("Trekk tilbake invitasjonen?")) return;

    setBusyId(inviteId);
    setToast(null);

    try {
      const res = await fetch("/api/admin/employees/invites/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });

      const json = (await readJsonOrThrow(res)) as ApiOk | ApiErr;
      if (!res.ok || !json || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
      }

      setToast({ ok: true, msg: (json as ApiOk).message || "Invitasjon trukket tilbake." });
      await load({ keepToast: true });
    } catch (e: any) {
      setToast({ ok: false, msg: e?.message ?? "Kunne ikke trekke tilbake." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-lg font-semibold">Invitasjoner</div>
          <div className="text-sm text-[rgb(var(--lp-muted))]">
            Pending invitasjoner for ansatte. Ingen profiler/brukere opprettes før aksept.
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk e-post, navn, avdeling"
            className="w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
          />
          <button
            onClick={() => load()}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))]"
          >
            Oppdater
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[rgb(var(--lp-muted))]">
        <label className="inline-flex items-center gap-2 rounded-2xl bg-[rgb(var(--lp-surface))] px-3 py-2 ring-1 ring-[rgb(var(--lp-border))]">
          <input type="checkbox" checked={includeExpired} onChange={(e) => setIncludeExpired(e.target.checked)} />
          Vis utløpte
        </label>

        <label className="inline-flex items-center gap-2 rounded-2xl bg-[rgb(var(--lp-surface))] px-3 py-2 ring-1 ring-[rgb(var(--lp-border))]">
          <input type="checkbox" checked={includeUsed} onChange={(e) => setIncludeUsed(e.target.checked)} />
          Vis brukte
        </label>

        <button
          onClick={() => load()}
          className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold ring-1 ring-[rgb(var(--lp-border))]"
        >
          Bruk filter
        </button>
      </div>

      {toast ? (
        <div className={`mt-4 text-sm ${toast.ok ? "text-green-700" : "text-red-600"}`}>{toast.msg}</div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-3xl ring-1 ring-[rgb(var(--lp-border))]">
        <div className="bg-white p-4">
          {loading ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Laster…</div>
          ) : err ? (
            <div className="text-sm text-red-600">{err}</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Ingen invitasjoner funnet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-[rgb(var(--lp-muted))]">
                  <tr className="[&>th]:py-2 [&>th]:pr-3">
                    <th>E-post</th>
                    <th>Navn</th>
                    <th>Avdeling</th>
                    <th>Lokasjon</th>
                    <th>Status</th>
                    <th>Sist sendt</th>
                    <th>Utløper</th>
                    <th className="text-right">Handling</th>
                  </tr>
                </thead>
                <tbody className="[&>tr]:border-t [&>tr]:border-[rgb(var(--lp-border))]">
                  {filtered.map((r) => {
                    const st = statusChip(r);
                    const isBusy = busyId === r.id;

                    // Resend/revoke kun når ikke brukt
                    const canResend = !r.used_at;
                    const canRevoke = !r.used_at;

                    return (
                      <tr key={r.id} className="[&>td]:py-3 [&>td]:pr-3">
                        <td className="font-medium">{r.email}</td>
                        <td>{r.full_name ?? "—"}</td>
                        <td>{r.department ?? "—"}</td>
                        <td className="font-mono text-xs">{r.location_id ?? "—"}</td>
                        <td className="text-xs">
                          <span className={`rounded-full px-2 py-1 ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="text-xs text-[rgb(var(--lp-muted))]">{fmtTs(r.last_sent_at)}</td>
                        <td className="text-xs text-[rgb(var(--lp-muted))]">{fmtTs(r.expires_at)}</td>
                        <td className="text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              disabled={!canResend || isBusy}
                              onClick={() => resend(r.id)}
                              className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold ring-1 ring-[rgb(var(--lp-border))] disabled:opacity-50"
                            >
                              {isBusy ? "..." : "Send på nytt"}
                            </button>
                            <button
                              disabled={!canRevoke || isBusy}
                              onClick={() => revoke(r.id)}
                              className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold ring-1 ring-[rgb(var(--lp-border))] disabled:opacity-50"
                            >
                              Trekk tilbake
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
            Viser: <span className="font-medium">{filtered.length}</span> invitasjoner
          </div>
        </div>
      </div>
    </section>
  );
}

// components/admin/EmployeesTable.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  companyId: string;
  companyName?: string | null;
  viewerEmail?: string | null;
  canInvite?: boolean;
};

type EmployeeRow = {
  user_id: string;
  email: string | null;
  role: "employee" | "company_admin" | "superadmin" | "kitchen" | "driver" | null;
  department: string | null;
  location_id: string | null;
  disabled_at: string | null;
  disabled_reason?: string | null;
  is_active?: boolean | null;
  name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApiOkList = { ok: true; employees: EmployeeRow[]; total?: number; page?: number; limit?: number };
type ApiOkInvite = { ok: true; message?: string; employee?: any };
type ApiOkBulk = {
  ok: true;
  summary?: {
    total: number;
    sent: number;
    failed: number;
    exists: number;
    invalid: number;
    skipped_active_invite: number;
  };
  results?: { email: string; status: string; message?: string }[];
};
type ApiErr = { ok: false; error: string; message?: string; detail?: any };

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function dl(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

function statusLabel(r: EmployeeRow) {
  if (r.disabled_at) return "Deaktivert";
  if (r.is_active === false) return "Inaktiv";
  return "Aktiv";
}

function parseEmailLines(input: string): string[] {
  const raw = String(input ?? "")
    .split(/[\n,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of raw) {
    const n = String(e).trim().toLowerCase();
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export default function EmployeesTable({
  companyId,
  companyName = null,
  viewerEmail = null,
  canInvite = false,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");

  // Invite (single)
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDept, setInviteDept] = useState("");
  const [inviteLocationId, setInviteLocationId] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [inviteOk, setInviteOk] = useState<string | null>(null);

  // Bulk invite
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkDept, setBulkDept] = useState("");
  const [bulkLocationId, setBulkLocationId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkErr, setBulkErr] = useState<string | null>(null);
  const [bulkOk, setBulkOk] = useState<string | null>(null);
  const [bulkReport, setBulkReport] = useState<ApiOkBulk | null>(null);

  const [page] = useState(1);
  const [limit] = useState(200);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const url = `/api/admin/employees?companyId=${encodeURIComponent(companyId)}&page=${page}&limit=${limit}&q=${encodeURIComponent(
        q.trim()
      )}`;

      const res = await fetch(url, { method: "GET", headers: { "cache-control": "no-store" } });
      const json = (await readJsonOrThrow(res)) as ApiOkList | ApiErr;

      if (!res.ok || !json || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
      }

      setRows((json as ApiOkList).employees ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke hente ansatte.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!companyId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter((r) => {
      const email = String(r.email ?? "").toLowerCase();
      const name = String(r.name ?? r.full_name ?? "").toLowerCase();
      const dept = String(r.department ?? "").toLowerCase();
      const phone = String(r.phone ?? "").toLowerCase();
      return email.includes(needle) || name.includes(needle) || dept.includes(needle) || phone.includes(needle);
    });
  }, [rows, q]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => !r.disabled_at && r.is_active !== false).length;
    const disabled = rows.filter((r) => !!r.disabled_at).length;
    return { total, active, disabled };
  }, [rows]);

  function exportCsv() {
    const header = ["email", "name", "department", "location_id", "status", "disabled_at", "created_at"].join(",");
    const lines = filtered.map((r) =>
      [
        JSON.stringify(r.email ?? ""),
        JSON.stringify(r.name ?? r.full_name ?? ""),
        JSON.stringify(r.department ?? ""),
        JSON.stringify(r.location_id ?? ""),
        JSON.stringify(statusLabel(r)),
        JSON.stringify(r.disabled_at ?? ""),
        JSON.stringify(r.created_at ?? ""),
      ].join(",")
    );
    dl(`employees_${companyId}.csv`, [header, ...lines].join("\n"));
  }

  /**
   * ✅ SINGLE INVITE MUST HIT /invite (SINGULAR)
   * NOT /invites (PLURAL)
   */
  async function doInvite() {
    setInviteErr(null);
    setInviteOk(null);

    const email = safeText(inviteEmail).toLowerCase();
    if (!email || !isEmail(email)) {
      setInviteErr("Skriv inn en gyldig e-post.");
      return;
    }

    setInviteBusy(true);
    try {
      // IMPORTANT: singular endpoint
      const res = await fetch("/api/admin/employees/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          department: safeText(inviteDept) || null,
          location_id: safeText(inviteLocationId) || null,
        }),
      });

      const json = (await readJsonOrThrow(res)) as ApiOkInvite | ApiErr;

      if (!res.ok || !json || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
      }

      setInviteOk((json as ApiOkInvite).message || "Invitasjon sendt.");
      setInviteEmail("");
      setInviteDept("");
      setInviteLocationId("");
      await load();
    } catch (e: any) {
      setInviteErr(e?.message ?? "Kunne ikke sende invitasjon.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function doBulkInvite() {
    setBulkErr(null);
    setBulkOk(null);
    setBulkReport(null);

    const list = parseEmailLines(bulkText);
    if (!list.length) {
      setBulkErr("Lim inn minst én e-postadresse (én per linje, eller separert med komma).");
      return;
    }
    if (list.length > 200) {
      setBulkErr("Maks 200 e-poster per innsending. Del opp listen.");
      return;
    }

    const bad = list.filter((e) => !isEmail(e));
    if (bad.length) {
      setBulkErr(`Ugyldige e-poster: ${bad.slice(0, 5).join(", ")}${bad.length > 5 ? "…" : ""}`);
      return;
    }

    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/employees/invites/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          emails: list.join("\n"),
          department: safeText(bulkDept) || null,
          location_id: safeText(bulkLocationId) || null,
        }),
      });

      const json = (await readJsonOrThrow(res)) as ApiOkBulk | ApiErr;

      if (!res.ok || !json || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
      }

      setBulkReport(json as ApiOkBulk);
      setBulkOk("Invitasjoner behandlet. Se rapport under.");
      await load();
    } catch (e: any) {
      setBulkErr(e?.message ?? "Kunne ikke sende invitasjoner.");
    } finally {
      setBulkBusy(false);
    }
  }

  const bulkPreview = useMemo(() => parseEmailLines(bulkText), [bulkText]);

  function exportBulkReportCsv() {
    if (!bulkReport?.results?.length) return;
    const header = ["email", "status", "message"].join(",");
    const lines = bulkReport.results.map((r) =>
      [JSON.stringify(r.email), JSON.stringify(r.status), JSON.stringify(r.message ?? "")].join(",")
    );
    dl(`bulk_invites_${companyId}.csv`, [header, ...lines].join("\n"));
  }

  return (
    <section>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-lg font-semibold">Ansatte</div>
          <div className="text-sm text-[rgb(var(--lp-muted))]">
            Administrer ansatte i bedriften. Deaktivering sletter ikke historikk.
          </div>

          {companyName ? (
            <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
              Firma: <span className="font-medium">{companyName}</span>
              {viewerEmail ? (
                <>
                  {" "}
                  · Innlogget: <span className="font-mono">{viewerEmail}</span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk navn, e-post, avdeling"
            className="w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
          />

          <div className="flex items-center gap-2">
            {canInvite ? (
              <>
                <button
                  onClick={() => {
                    setInviteErr(null);
                    setInviteOk(null);
                    setInviteOpen(true);
                  }}
                  className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white"
                >
                  Inviter ansatt
                </button>

                <button
                  onClick={() => {
                    setBulkErr(null);
                    setBulkOk(null);
                    setBulkReport(null);
                    setBulkOpen(true);
                  }}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))]"
                >
                  Inviter e-postliste
                </button>
              </>
            ) : null}

            <button
              onClick={exportCsv}
              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))]"
            >
              Last ned CSV
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-3xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs text-[rgb(var(--lp-muted))]">Viser</div>
          <div className="mt-1 text-xl font-semibold">{filtered.length}</div>
        </div>
        <div className="rounded-3xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs text-[rgb(var(--lp-muted))]">Aktive (i listen)</div>
          <div className="mt-1 text-xl font-semibold">
            {filtered.filter((r) => !r.disabled_at && r.is_active !== false).length}
          </div>
        </div>
        <div className="rounded-3xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs text-[rgb(var(--lp-muted))]">Deaktivert (i listen)</div>
          <div className="mt-1 text-xl font-semibold">{filtered.filter((r) => !!r.disabled_at).length}</div>
        </div>
        <div className="rounded-3xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs text-[rgb(var(--lp-muted))]">Totalt (alle)</div>
          <div className="mt-1 text-xl font-semibold">{stats.total}</div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-3xl ring-1 ring-[rgb(var(--lp-border))]">
        <div className="bg-white p-4">
          {loading ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Laster…</div>
          ) : err ? (
            <div className="text-sm text-red-600">{err}</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Ingen ansatte funnet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-[rgb(var(--lp-muted))]">
                  <tr className="[&>th]:py-2 [&>th]:pr-3">
                    <th>Navn</th>
                    <th>E-post</th>
                    <th>Avdeling</th>
                    <th>Lokasjon</th>
                    <th>Status</th>
                    <th>Opprettet</th>
                    <th className="text-right">Handling</th>
                  </tr>
                </thead>
                <tbody className="[&>tr]:border-t [&>tr]:border-[rgb(var(--lp-border))]">
                  {filtered.map((r) => (
                    <tr key={r.user_id} className="[&>td]:py-3 [&>td]:pr-3">
                      <td className="font-medium">{r.name ?? r.full_name ?? "—"}</td>
                      <td>{r.email ?? "—"}</td>
                      <td>{r.department ?? "—"}</td>
                      <td className="font-mono text-xs">{r.location_id ?? "—"}</td>
                      <td className="text-xs">
                        <span className="rounded-full bg-white px-2 py-1 ring-1 ring-[rgb(var(--lp-border))]">
                          {statusLabel(r)}
                        </span>
                      </td>
                      <td className="text-xs text-[rgb(var(--lp-muted))]">{fmtTs(r.created_at)}</td>
                      <td className="text-right text-xs text-[rgb(var(--lp-muted))]">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-xs text-[rgb(var(--lp-muted))]">
            <div>
              Firma-ID: <span className="font-mono">{companyId}</span>
            </div>
            <button onClick={load} className="rounded-xl bg-white px-3 py-2 ring-1 ring-[rgb(var(--lp-border))]">
              Oppdater
            </button>
          </div>
        </div>
      </div>

      {/* Invite modal (single) */}
      {inviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Inviter ansatt</div>
                <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
                  Sender invitasjon på e-post. Ingen profil/bruker opprettes før aksept.
                </div>
              </div>
              <button
                onClick={() => setInviteOpen(false)}
                className="rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
              >
                Lukk
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="text-xs text-[rgb(var(--lp-muted))]">E-post</label>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="navn@firma.no"
                  className="mt-1 w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs text-[rgb(var(--lp-muted))]">Avdeling (valgfritt)</label>
                  <input
                    value={inviteDept}
                    onChange={(e) => setInviteDept(e.target.value)}
                    placeholder="F.eks. Salg"
                    className="mt-1 w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[rgb(var(--lp-muted))]">Lokasjon-ID (valgfritt)</label>
                  <input
                    value={inviteLocationId}
                    onChange={(e) => setInviteLocationId(e.target.value)}
                    placeholder="UUID"
                    className="mt-1 w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
                  />
                </div>
              </div>

              {inviteErr ? <div className="text-sm text-red-600">{inviteErr}</div> : null}
              {inviteOk ? <div className="text-sm text-green-700">{inviteOk}</div> : null}

              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => setInviteOpen(false)}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))]"
                >
                  Avbryt
                </button>
                <button
                  disabled={inviteBusy}
                  onClick={doInvite}
                  className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {inviteBusy ? "Sender…" : "Send invitasjon"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bulk invite modal */}
      {bulkOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Inviter e-postliste</div>
                <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
                  Lim inn e-poster (én per linje, eller separert med komma/semikolon). Ingen profil/bruker opprettes før aksept.
                </div>
              </div>
              <button
                onClick={() => setBulkOpen(false)}
                className="rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
              >
                Lukk
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="grid gap-3">
                <div>
                  <label className="text-xs text-[rgb(var(--lp-muted))]">E-postliste</label>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={"ola@firma.no\nkari@firma.no\n..."}
                    className="mt-1 h-48 w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
                  />
                  <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                    Unike e-poster funnet: <span className="font-semibold">{bulkPreview.length}</span> (maks 200)
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-[rgb(var(--lp-muted))]">Avdeling (valgfritt)</label>
                    <input
                      value={bulkDept}
                      onChange={(e) => setBulkDept(e.target.value)}
                      placeholder="F.eks. Salg"
                      className="mt-1 w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[rgb(var(--lp-muted))]">Lokasjon-ID (valgfritt)</label>
                    <input
                      value={bulkLocationId}
                      onChange={(e) => setBulkLocationId(e.target.value)}
                      placeholder="UUID"
                      className="mt-1 w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]"
                    />
                  </div>
                </div>

                {bulkErr ? <div className="text-sm text-red-600">{bulkErr}</div> : null}
                {bulkOk ? <div className="text-sm text-green-700">{bulkOk}</div> : null}

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setBulkOpen(false)}
                    className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))]"
                  >
                    Avbryt
                  </button>
                  <button
                    disabled={bulkBusy}
                    onClick={doBulkInvite}
                    className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {bulkBusy ? "Sender…" : "Send invitasjoner"}
                  </button>
                </div>
              </div>

              <div className="rounded-3xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-sm font-semibold">Rapport</div>
                <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Viser resultat per e-post etter kjøring.</div>

                {bulkReport?.summary ? (
                  <div className="mt-3 grid gap-2 text-sm">
                    <div>Totalt: <span className="font-semibold">{bulkReport.summary.total}</span></div>
                    <div>Sendt: <span className="font-semibold">{bulkReport.summary.sent}</span></div>
                    <div>Feilet: <span className="font-semibold">{bulkReport.summary.failed}</span></div>
                    <div>Finnes: <span className="font-semibold">{bulkReport.summary.exists}</span></div>
                    <div>Ugyldig: <span className="font-semibold">{bulkReport.summary.invalid}</span></div>
                    <div>Allerede aktiv invite: <span className="font-semibold">{bulkReport.summary.skipped_active_invite}</span></div>

                    <div className="mt-3">
                      <button
                        onClick={exportBulkReportCsv}
                        disabled={!bulkReport?.results?.length}
                        className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold ring-1 ring-[rgb(var(--lp-border))] disabled:opacity-50"
                      >
                        Last ned rapport CSV
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-[rgb(var(--lp-muted))]">Ingen rapport ennå.</div>
                )}

                {bulkReport?.results?.length ? (
                  <div className="mt-4 max-h-56 overflow-auto rounded-2xl bg-white p-3 ring-1 ring-[rgb(var(--lp-border))]">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[rgb(var(--lp-muted))]">
                        <tr className="[&>th]:pb-2 [&>th]:pr-2">
                          <th>E-post</th>
                          <th>Status</th>
                          <th>Melding</th>
                        </tr>
                      </thead>
                      <tbody className="[&>tr]:border-t [&>tr]:border-[rgb(var(--lp-border))]">
                        {bulkReport.results.slice(0, 200).map((r, idx) => (
                          <tr key={idx} className="[&>td]:py-2 [&>td]:pr-2">
                            <td className="font-medium">{r.email}</td>
                            <td className="font-mono">{r.status}</td>
                            <td className="text-[rgb(var(--lp-muted))]">{r.message ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

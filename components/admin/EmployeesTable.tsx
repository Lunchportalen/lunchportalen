// components/admin/EmployeesTable.tsx
"use client";

import { useMemo, useState } from "react";
import { formatDateTimeNO } from "@/lib/date/format";

type Props = {
  companyId: string;
  companyName?: string | null;
  viewerEmail?: string | null;
  canInvite?: boolean;
  initialQuery?: string;
  employees?: EmployeeRow[];
  loading?: boolean;
  error?: string | null;
  onReload?: () => Promise<void> | void;
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

type InviteResult = {
  email: string;
  status: "created" | "already_exists" | "already_invited" | "invalid" | "failed";
  message?: string;
};

type BulkSummary = {
  total: number;
  created: number;
  already_exists: number;
  already_invited: number;
  invalid: number;
  failed: number;
};

type ApiOk = { ok: true; rid: string; data: { summary?: BulkSummary; results?: InviteResult[] } };

type ApiErr = { ok: false; rid: string; error: string; message?: string };

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
  if (!ts) return "-";
  return formatDateTimeNO(ts);
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
  initialQuery = "",
  employees = [],
  loading = false,
  error = null,
  onReload,
}: Props) {
  const [q, setQ] = useState(initialQuery);
  const [copied, setCopied] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDept, setInviteDept] = useState("");
  const [inviteLocationId, setInviteLocationId] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [inviteOk, setInviteOk] = useState<string | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkDept, setBulkDept] = useState("");
  const [bulkLocationId, setBulkLocationId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkErr, setBulkErr] = useState<string | null>(null);
  const [bulkOk, setBulkOk] = useState<string | null>(null);
  const [bulkReport, setBulkReport] = useState<ApiOk | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return employees;

    return employees.filter((r) => {
      const email = String(r.email ?? "").toLowerCase();
      const name = String(r.name ?? r.full_name ?? "").toLowerCase();
      const dept = String(r.department ?? "").toLowerCase();
      const phone = String(r.phone ?? "").toLowerCase();
      return email.includes(needle) || name.includes(needle) || dept.includes(needle) || phone.includes(needle);
    });
  }, [employees, q]);

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((r) => !r.disabled_at && r.is_active !== false).length;
    const disabled = employees.filter((r) => !!r.disabled_at).length;
    return { total, active, disabled };
  }, [employees]);

  function exportCsv() {
    const header = ["email", "name", "department", "location_id", "status", "disabled_at", "created_at"].join(","
    );
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

  async function doReload() {
    if (onReload) await onReload();
  }

  async function copyCompanyId() {
    try {
      await navigator.clipboard.writeText(companyId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

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
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          department: safeText(inviteDept) || null,
          location_id: safeText(inviteLocationId) || null,
        }),
      });

      const json = (await readJsonOrThrow(res)) as ApiOk | ApiErr;

      if (!res.ok || !json || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(`${j?.message || j?.error || `HTTP ${res.status}`}${j?.rid ? ` (RID: ${j.rid})` : ""}`);
      }

      const ok = json as ApiOk;
      const result = ok.data?.results?.[0];
      if (result?.status === "already_invited") {
        setInviteOk("Aktiv invitasjon finnes allerede.");
      } else if (result?.status === "created") {
        setInviteOk("Invitasjon sendt.");
      } else if (result?.status === "already_exists") {
        setInviteErr("E-posten er allerede registrert i et firma.");
      } else if (result?.status === "invalid") {
        setInviteErr(result.message || "Ugyldig e-postadresse.");
      } else if (result?.status === "failed") {
        setInviteErr(result.message || "Kunne ikke sende invitasjon.");
      } else {
        setInviteOk("Invitasjon sendt.");
      }

      setInviteEmail("");
      setInviteDept("");
      setInviteLocationId("");
      await doReload();
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
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          emails: list.join("\n"),
          department: safeText(bulkDept) || null,
          location_id: safeText(bulkLocationId) || null,
        }),
      });

      const json = (await readJsonOrThrow(res)) as ApiOk | ApiErr;

      if (!res.ok || !json || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(`${j?.message || j?.error || `HTTP ${res.status}`}${j?.rid ? ` (RID: ${j.rid})` : ""}`);
      }

      const ok = json as ApiOk;
      setBulkReport(ok);
      setBulkOk("Invitasjoner behandlet. Se rapport under.");
      await doReload();
    } catch (e: any) {
      setBulkErr(e?.message ?? "Kunne ikke sende invitasjoner.");
    } finally {
      setBulkBusy(false);
    }
  }

  const bulkPreview = useMemo(() => parseEmailLines(bulkText), [bulkText]);

  function exportBulkReportCsv() {
    if (!bulkReport?.data?.results?.length) return;
    const header = ["email", "status", "message"].join(",");
    const lines = bulkReport.data.results.map((r) =>
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

      <div className="mt-4 overflow-hidden rounded-3xl ring-1 ring-[rgb(var(--lp-border))]">
        <div className="bg-white p-4">
          {loading ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Laster…</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-6 text-sm text-[rgb(var(--lp-muted))]">
              <div className="text-base font-semibold text-[rgb(var(--lp-text))]">Ingen ansatte registrert</div>
              <p className="mt-2">
                Inviter ansatte for å gi tilgang til bestilling innenfor avtalen.
              </p>
              {canInvite ? (
                <div className="mt-4 flex flex-wrap gap-2">
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
                </div>
              ) : null}
            </div>
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
                      <td className="font-medium">{r.name ?? r.full_name ?? "-"}</td>
                      <td>{r.email ?? "-"}</td>
                      <td>{r.department ?? "-"}</td>
                      <td className="font-mono text-xs">{r.location_id ?? "-"}</td>
                      <td className="text-xs">
                        <span className="rounded-full bg-white px-2 py-1 ring-1 ring-[rgb(var(--lp-border))]">
                          {statusLabel(r)}
                        </span>
                      </td>
                      <td className="text-xs text-[rgb(var(--lp-muted))]">{fmtTs(r.created_at)}</td>
                      <td className="text-right text-xs text-[rgb(var(--lp-muted))]">-</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-xs text-[rgb(var(--lp-muted))]">
            <button
              onClick={copyCompanyId}
              className="rounded-xl bg-white px-3 py-2 font-semibold ring-1 ring-[rgb(var(--lp-border))]"
              title={companyId}
            >
              {copied ? "Kopiert" : "Kopier firma-ID"}
            </button>
            <button onClick={doReload} className="rounded-xl bg-white px-3 py-2 ring-1 ring-[rgb(var(--lp-border))]">
              Oppdater
            </button>
          </div>
        </div>
      </div>

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

                {bulkReport?.data?.summary ? (
                  <div className="mt-3 grid gap-2 text-sm">
                    <div>Totalt: <span className="font-semibold">{bulkReport.data.summary.total}</span></div>
                    <div>Sendt: <span className="font-semibold">{bulkReport.data.summary.created}</span></div>
                    <div>Feilet: <span className="font-semibold">{bulkReport.data.summary.failed}</span></div>
                    <div>Finnes: <span className="font-semibold">{bulkReport.data.summary.already_exists}</span></div>
                    <div>Ugyldig: <span className="font-semibold">{bulkReport.data.summary.invalid}</span></div>
                    <div>Allerede aktiv invite: <span className="font-semibold">{bulkReport.data.summary.already_invited}</span></div>

                    <div className="mt-3">
                      <button
                        onClick={exportBulkReportCsv}
                        disabled={!bulkReport?.data?.results?.length}
                        className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold ring-1 ring-[rgb(var(--lp-border))] disabled:opacity-50"
                      >
                        Last ned rapport CSV
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-[rgb(var(--lp-muted))]">Ingen rapport ennå.</div>
                )}

                {bulkReport?.data?.results?.length ? (
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
                        {bulkReport.data.results.slice(0, 200).map((r, idx) => (
                          <tr key={idx} className="[&>td]:py-2 [&>td]:pr-2">
                            <td className="font-medium">{r.email}</td>
                            <td className="font-mono">{r.status}</td>
                            <td className="text-[rgb(var(--lp-muted))]">{r.message ?? "-"}</td>
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


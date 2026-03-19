"use client";

import { useMemo, useState } from "react";
import InvitesPanel from "@/components/admin/InvitesPanel";

type Props = {
  companyId: string;
  companyName: string;
};

type InviteRow = {
  full_name: string | null;
  email: string;
  department: string | null;
};

type InviteResult = {
  email: string;
  status: "created" | "already_exists" | "already_invited" | "failed";
  message?: string;
  inviteId?: string | null;
  inviteUrl?: string | null;
};

type ApiOk = {
  ok: true;
  rid: string;
  data: {
    summary: {
      total: number;
      created: number;
      already_exists: number;
      already_invited: number;
      failed: number;
    };
    results: InviteResult[];
  };
};

type ApiErr = { ok: false; rid?: string; error: string; message?: string; detail?: any };

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function clientRid() {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function parseBulkLines(text: string) {
  const lines = String(text ?? "")
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: Array<{
    line: string;
    email: string;
    full_name: string;
    department: string;
    error: string | null;
  }> = [];

  const seen = new Set<string>();

  for (const line of lines) {
    const parts = line.split(";").map((p) => p.trim());
    const full_name = safeText(parts[0] ?? "");
    const email = safeText(parts[1] ?? parts[0] ?? "").toLowerCase();
    const department = safeText(parts[2] ?? "");

    let error: string | null = null;
    if (!email || !isEmail(email)) error = "Ugyldig e-post";
    if (email && seen.has(email)) error = "Duplikat";
    if (email) seen.add(email);

    rows.push({ line, email, full_name, department, error });
  }

  return rows;
}

export default function InviteClient({ companyId, companyName }: Props) {
  const [singleName, setSingleName] = useState("");
  const [singleEmail, setSingleEmail] = useState("");
  const [singleDept, setSingleDept] = useState("");

  const [bulkText, setBulkText] = useState("");

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiOk["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);

  const bulkRows = useMemo(() => parseBulkLines(bulkText), [bulkText]);
  const bulkValid = bulkRows.filter((r) => !r.error);
  const bulkInvalid = bulkRows.filter((r) => r.error);

  async function sendInvites(invites: InviteRow[]) {
    setBusy(true);
    setError(null);
    setResult(null);
    setRid(null);

    const localRid = clientRid();

    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "content-type": "application/json", "x-rid": localRid },
        body: JSON.stringify({ invites }),
      });
      const json = (await res.json().catch(() => null)) as ApiOk | ApiErr | null;

      if (!res.ok || !json || (json as any).ok !== true) {
        const j = json as ApiErr;
        throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
      }

      setResult((json as ApiOk).data);
      setRid((json as ApiOk).rid || localRid);
    } catch (e: any) {
      setError(String(e?.message ?? "Kunne ikke sende invitasjon."));
      setRid(localRid);
    } finally {
      setBusy(false);
    }
  }

  async function onSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = safeText(singleEmail).toLowerCase();
    const full_name = safeText(singleName);
    const department = safeText(singleDept);

    if (!email || !isEmail(email)) {
      setError("Skriv inn en gyldig e-post.");
      return;
    }

    await sendInvites([{ email, full_name: full_name || null, department: department || null }]);
  }

  async function onBulkSubmit() {
    if (!bulkRows.length) {
      setError("Lim inn minst én linje.");
      return;
    }
    if (bulkInvalid.length) {
      setError("Listen inneholder feil. Rett opp før innsending.");
      return;
    }

    const invites = bulkValid.map((r) => ({
      email: r.email,
      full_name: r.full_name || null,
      department: r.department || null,
    }));

    await sendInvites(invites);
  }

  return (
    <div className="space-y-6">
      <section className="lp-glass-card rounded-3xl p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-neutral-900">Enkeltinvitasjon</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Sender invitasjon til én ansatt. Firma: <span className="font-semibold">{companyName}</span>
          </p>
        </div>

        <form onSubmit={onSingleSubmit} className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs text-neutral-600">Fullt navn</label>
            <input
              value={singleName}
              onChange={(e) => setSingleName(e.target.value)}
              placeholder="F.eks. Ola Nordmann"
              className="mt-1 w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-black/10 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-600">E-post *</label>
            <input
              value={singleEmail}
              onChange={(e) => setSingleEmail(e.target.value)}
              placeholder="navn@firma.no"
              className="mt-1 w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-black/10 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-600">Avdeling (valgfritt)</label>
            <input
              value={singleDept}
              onChange={(e) => setSingleDept(e.target.value)}
              placeholder="F.eks. Salg"
              className="mt-1 w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-black/10 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3 flex items-center justify-between">
            <div className="text-xs text-neutral-500">RID logges automatisk for sporbarhet.</div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-2xl bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Sender…" : "Send invitasjon"}
            </button>
          </div>
        </form>
      </section>

      <section className="lp-glass-card rounded-3xl p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-neutral-900">Bulk-invitasjon</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Lim inn én linje per ansatt: <span className="font-mono">Navn;epost;avdeling</span>
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="text-xs text-neutral-600">Liste</label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"Ola Nordmann;ola@firma.no;Salg\nKari Nordmann;kari@firma.no;HR"}
              className="mt-1 h-48 w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-black/10 focus:outline-none"
            />
            <div className="mt-2 text-xs text-neutral-500">
              Gyldige rader: <span className="font-semibold">{bulkValid.length}</span> · Feil:{" "}
              <span className="font-semibold">{bulkInvalid.length}</span>
            </div>
          </div>

          <div className="rounded-3xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
            <div className="text-sm font-semibold">Forhåndsvisning</div>
            <div className="mt-1 text-xs text-neutral-600">OK/Feil pr. rad</div>

            <div className="mt-3 max-h-52 overflow-auto rounded-2xl bg-white p-3 ring-1 ring-black/5">
              {bulkRows.length === 0 ? (
                <div className="text-xs text-neutral-500">Ingen rader.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="text-neutral-500">
                    <tr className="[&>th]:pb-2 [&>th]:pr-2">
                      <th>Status</th>
                      <th>Navn</th>
                      <th>E-post</th>
                      <th>Avdeling</th>
                    </tr>
                  </thead>
                  <tbody className="[&>tr]:border-t [&>tr]:border-black/5">
                    {bulkRows.map((r, idx) => (
                      <tr key={idx} className="[&>td]:py-2 [&>td]:pr-2">
                        <td className={r.error ? "text-rose-600" : "text-emerald-700"}>
                          {r.error ? "Feil" : "OK"}
                        </td>
                        <td>{r.full_name || "—"}</td>
                        <td className="font-mono">{r.email || "—"}</td>
                        <td>{r.department || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end">
              <button
                onClick={onBulkSubmit}
                disabled={busy || bulkRows.length === 0 || bulkInvalid.length > 0}
                className="rounded-2xl bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Sender…" : `Send ${bulkValid.length} invitasjoner`}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-glass-card rounded-3xl p-6">
        <div className="mb-3 text-sm font-semibold text-neutral-900">Resultat</div>
        {error ? <div className="text-sm text-rose-700">{error}</div> : null}
        {!error && !result ? <div className="text-sm text-neutral-600">Ingen resultater ennå.</div> : null}

        {result ? (
          <>
            <div className="text-sm text-neutral-700">
              Sendt: <span className="font-semibold">{result.summary.created}</span> · Allerede invitert:{" "}
              <span className="font-semibold">{result.summary.already_invited}</span> · Finnes:{" "}
              <span className="font-semibold">{result.summary.already_exists}</span> · Feil:{" "}
              <span className="font-semibold">{result.summary.failed}</span>
            </div>
            <div className="mt-2 text-xs text-neutral-500">RID: {rid ?? "—"}</div>

            <div className="mt-4 max-h-56 overflow-auto rounded-2xl bg-white p-3 ring-1 ring-black/5">
              <table className="w-full text-left text-xs">
                <thead className="text-neutral-500">
                  <tr className="[&>th]:pb-2 [&>th]:pr-2">
                    <th>E-post</th>
                    <th>Status</th>
                    <th>Melding</th>
                  </tr>
                </thead>
                <tbody className="[&>tr]:border-t [&>tr]:border-black/5">
                  {(Array.isArray(result.results) ? result.results : []).map((r, idx) => (
                    <tr key={idx} className="[&>td]:py-2 [&>td]:pr-2">
                      <td className="font-medium">{r.email}</td>
                      <td className="font-mono">{r.status}</td>
                      <td className="text-neutral-600">{r.message ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className="lp-glass-card rounded-3xl p-6">
        <div className="mb-3 text-sm font-semibold text-neutral-900">Siste invitasjoner</div>
        <InvitesPanel />
      </section>

      <div className="text-xs text-neutral-500">
        Firma-ID: <span className="font-mono">{companyId}</span>
      </div>
    </div>
  );
}


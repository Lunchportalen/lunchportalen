"use client";

import { useState } from "react";
import { DsButton } from "@/components/ui/ds";

type ApiOk = { ok: true; rid: string; data: unknown };
type ApiErr = { ok: false; rid: string; message?: string; error?: string };
type ApiEnvelope = ApiOk | ApiErr;

function isApiErr(x: ApiEnvelope): x is ApiErr {
  return x.ok === false;
}

export function ControlRunClient() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);

  async function run(force: boolean) {
    setBusy(true);
    setMsg(null);
    setRid(null);
    try {
      const res = await fetch("/api/backoffice/ceo/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force }),
        credentials: "include",
      });
      const j = (await res.json()) as ApiEnvelope;
      setRid(j.rid ?? null);
      if (isApiErr(j)) {
        setMsg(j.message ?? j.error ?? "Feilet");
        return;
      }
      const d = j.data as { skipped?: boolean; skipReason?: string; decisions?: unknown[] };
      if (d?.skipped) {
        setMsg(`Hoppet over: ${d.skipReason ?? "ukjent"}`);
      } else {
        setMsg(`Fullført. Beslutninger: ${Array.isArray(d?.decisions) ? d.decisions.length : 0}`);
      }
    } catch {
      setMsg("Nettverksfeil");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Kjør CEO-syklus</h2>
      <p className="mt-1 text-sm text-slate-600">
        Maks én kjøring per time (med mindre tvungen). Kun logging — ingen automatisk publisering.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <DsButton type="button" variant="primary" disabled={busy} onClick={() => run(false)}>
          {busy ? "Kjører…" : "Kjør nå"}
        </DsButton>
        <DsButton type="button" variant="secondary" disabled={busy} onClick={() => run(true)}>
          Tvungen kjøring
        </DsButton>
      </div>
      {msg ? <p className="mt-2 text-sm text-slate-800">{msg}</p> : null}
      {rid ? <p className="mt-1 font-mono text-xs text-slate-500">RID: {rid}</p> : null}
    </div>
  );
}

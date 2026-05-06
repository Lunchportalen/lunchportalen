"use client";

import { useState } from "react";
import { DsButton } from "@/components/ui/ds";

type ApiOk = { ok: true; rid: string; data: unknown };
type ApiErr = { ok: false; rid: string; message?: string; error?: string };
type ApiEnvelope = ApiOk | ApiErr;

function isApiErr(x: ApiEnvelope): x is ApiErr {
  return x.ok === false;
}

export function AiControlRunClient() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);

  async function run(opts: { force: boolean; eventDriven: boolean }) {
    setBusy(true);
    setMsg(null);
    setRid(null);
    try {
      const res = await fetch("/api/backoffice/autonomy/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(opts),
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
    <div className="lp-card p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="lp-h2 text-[rgb(var(--lp-text))]">Kjør autonom syklus</h2>
          <p className="lp-lead mt-1 text-sm">
        Maks to sikre logg-rader per kjøring. Ingen publisering eller kodeendring.
          </p>
        </div>
        <span className="lp-chip lp-chip-neutral shrink-0">Sporbar kjøring</span>
      </div>
      <div className="lp-actions mt-5">
        <DsButton type="button" variant="primary" disabled={busy} onClick={() => run({ force: false, eventDriven: false })}>
          {busy ? "Kjører…" : "Kjør nå"}
        </DsButton>
        <DsButton type="button" variant="secondary" disabled={busy} onClick={() => run({ force: true, eventDriven: false })}>
          Tvungen
        </DsButton>
        <DsButton type="button" variant="ghost" disabled={busy} onClick={() => run({ force: false, eventDriven: true })}>
          Med hendelser
        </DsButton>
      </div>
      {msg ? <p className="mt-4 text-sm font-semibold text-[rgb(var(--lp-text))]">{msg}</p> : null}
      {rid ? <p className="lp-rid mt-1">RID: {rid}</p> : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";

type Eligibility = {
  canArchive: boolean;
  canHardDelete: boolean;
  blockers: string[];
  protectedPilot: boolean;
  archiveConfirmHint: string | null;
  hardDeleteConfirmHint: string | null;
};

type ApiOk = { ok: true; data: Eligibility & { companyName?: string | null; orgnr?: string | null } };
type ApiErr = { ok: false; message?: string; detail?: { blockers?: string[] } };

async function readJsonSafe(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export default function CompanyRemovalDialog(props: {
  open: boolean;
  companyId: string;
  companyName: string;
  orgnr: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { open, companyId, companyName, orgnr, onClose, onDone } = props;
  const [mode, setMode] = useState<"archive" | "hard_delete">("archive");
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setConfirm("");
    setReason("");
    setErr(null);
    setBlockers([]);
    setMode("archive");
    setLoadingEligibility(true);

    fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}/remove`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (res) => {
        const body = (await readJsonSafe(res)) as ApiOk | ApiErr | null;
        if (!res.ok || !body || body.ok !== true) {
          setEligibility(null);
          setErr((body as ApiErr)?.message || "Kunne ikke laste fjerningsregler.");
          return;
        }
        const d = body.data;
        setEligibility({
          canArchive: d.canArchive,
          canHardDelete: d.canHardDelete,
          blockers: d.blockers ?? [],
          protectedPilot: d.protectedPilot,
          archiveConfirmHint: d.archiveConfirmHint ?? (orgnr ? `${orgnr} ARKIVER` : null),
          hardDeleteConfirmHint: d.hardDeleteConfirmHint ?? companyName,
        });
      })
      .catch(() => {
        setEligibility(null);
        setErr("Kunne ikke laste fjerningsregler.");
      })
      .finally(() => setLoadingEligibility(false));
  }, [open, companyId, companyName, orgnr]);

  const confirmHint = useMemo(() => {
    if (mode === "hard_delete") return eligibility?.hardDeleteConfirmHint ?? companyName;
    return eligibility?.archiveConfirmHint ?? (orgnr ? `${orgnr} ARKIVER` : "");
  }, [mode, eligibility, companyName, orgnr]);

  function submit() {
    setErr(null);
    setBlockers([]);
    startTransition(async () => {
      const res = await fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}/remove`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, confirmation: confirm, reason: reason || null }),
      });
      const body = (await readJsonSafe(res)) as { ok?: boolean; message?: string; detail?: { blockers?: string[] } } | null;
      if (!res.ok || body?.ok !== true) {
        setErr(body?.message || "Handlingen feilet.");
        setBlockers(Array.isArray(body?.detail?.blockers) ? body!.detail!.blockers! : []);
        return;
      }
      onDone();
      onClose();
    });
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <button type="button" className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} aria-label="Lukk" />
      <div className="relative w-[min(92vw,560px)] rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Firmaadministrasjon</p>
        <h2 className="mt-1 text-lg font-semibold text-neutral-950">{mode === "archive" ? "Arkiver firma" : "Slett permanent"}</h2>
        <p className="mt-2 text-sm text-neutral-700">
          <span className="font-semibold">{companyName}</span>
          {orgnr ? <span className="text-neutral-500"> · {orgnr}</span> : null}
        </p>

        {loadingEligibility ? <p className="mt-4 text-sm text-neutral-500">Laster regler…</p> : null}

        {eligibility?.protectedPilot ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Beskyttet pilotfirma — permanent sletting er deaktivert.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={[
              "rounded-full border px-3 py-1.5 text-xs font-semibold",
              mode === "archive" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50",
            ].join(" ")}
            onClick={() => setMode("archive")}
            disabled={!eligibility?.canArchive}
          >
            Arkiver
          </button>
          <button
            type="button"
            className={[
              "rounded-full border px-3 py-1.5 text-xs font-semibold",
              mode === "hard_delete" ? "bg-rose-700 text-white" : "bg-white hover:bg-neutral-50",
              !eligibility?.canHardDelete ? "opacity-40" : "",
            ].join(" ")}
            onClick={() => setMode("hard_delete")}
            disabled={!eligibility?.canHardDelete}
          >
            Slett permanent
          </button>
        </div>

        {mode === "hard_delete" && eligibility && !eligibility.canHardDelete ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-neutral-600">
            {(eligibility.blockers.length ? eligibility.blockers : ["Avhengigheter finnes."]).map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}

        {mode === "archive" ? (
          <p className="mt-3 text-xs text-neutral-600">
            Arkivering stenger tilgang og beholder ordre, avtaler og audit. Auth-brukere fjernes.
          </p>
        ) : (
          <p className="mt-3 text-xs text-rose-800">Permanent sletting er kun tillatt for test-/feilfirma uten historikk.</p>
        )}

        <label className="mt-4 block text-xs font-semibold text-neutral-600">
          Bekreftelse {confirmHint ? `(skriv: ${confirmHint})` : ""}
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            autoComplete="off"
          />
        </label>

        <label className="mt-3 block text-xs font-semibold text-neutral-600">
          Begrunnelse (valgfritt)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </label>

        {err ? <p className="mt-3 text-sm font-semibold text-red-700">{err}</p> : null}
        {blockers.length ? (
          <ul className="mt-2 list-disc pl-5 text-xs text-red-700">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="rounded-full border px-4 py-2 text-sm hover:bg-neutral-50" onClick={onClose} disabled={pending}>
            Avbryt
          </button>
          <button
            type="button"
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50",
              mode === "hard_delete" ? "bg-rose-700 hover:bg-rose-800" : "bg-neutral-900 hover:bg-neutral-800",
            ].join(" ")}
            onClick={submit}
            disabled={pending || !confirm || loadingEligibility || (mode === "archive" && !eligibility?.canArchive) || (mode === "hard_delete" && !eligibility?.canHardDelete)}
          >
            {pending ? "Utfører…" : mode === "archive" ? "Arkiver firma" : "Slett permanent"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

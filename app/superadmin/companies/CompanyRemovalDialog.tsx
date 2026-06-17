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
type ApiErr = { ok: false; message?: string; error?: string; detail?: { blockers?: string[] } | { detail?: { blockers?: string[] } } };

async function readJsonSafe(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function parseBlockers(body: ApiErr | null): string[] {
  if (!body?.detail) return [];
  const d = body.detail as { blockers?: string[]; detail?: { blockers?: string[] } };
  if (Array.isArray(d.blockers)) return d.blockers;
  if (Array.isArray(d.detail?.blockers)) return d.detail.blockers;
  return [];
}

function parseApiMessage(body: ApiErr | null, fallback: string) {
  return body?.message || (typeof body?.error === "string" ? body.error : null) || fallback;
}

export default function CompanyRemovalDialog(props: {
  open: boolean;
  companyId: string;
  companyName: string;
  orgnr: string | null;
  onClose: () => void;
  onDone: (result: { mode: "archive" | "hard_delete" }) => void;
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
    setEligibility(null);

    fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}/remove`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await readJsonSafe(res)) as ApiOk | ApiErr | null;
        if (!res.ok || !body || body.ok !== true) {
          setEligibility(null);
          setErr(parseApiMessage(body as ApiErr, `Kunne ikke laste fjerningsregler (HTTP ${res.status}).`));
          setBlockers(parseBlockers(body as ApiErr));
          return;
        }
        const d = body.data;
        const next: Eligibility = {
          canArchive: d.canArchive,
          canHardDelete: d.canHardDelete,
          blockers: d.blockers ?? [],
          protectedPilot: d.protectedPilot,
          archiveConfirmHint: d.archiveConfirmHint ?? (orgnr ? `${orgnr} ARKIVER` : null),
          hardDeleteConfirmHint: d.hardDeleteConfirmHint ?? companyName,
        };
        setEligibility(next);
        setMode("archive");
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

  const dialogTitle = useMemo(() => {
    if (loadingEligibility) return "Laster fjerningsregler…";
    if (!eligibility?.canArchive && !loadingEligibility && eligibility && !eligibility.canHardDelete) {
      return "Firma kan ikke fjernes";
    }
    if (mode === "hard_delete" && eligibility?.canHardDelete) return "Slett permanent";
    if (eligibility && !eligibility.canHardDelete) return "Firma kan arkiveres, men ikke slettes permanent";
    return "Arkiver firma";
  }, [loadingEligibility, eligibility, mode]);

  const confirmMatches = useMemo(() => {
    const v = confirm.trim();
    if (!v) return false;
    if (mode === "hard_delete") {
      return v === (companyName || "") || (orgnr ? v === orgnr : false);
    }
    if (!orgnr) return false;
    return v === `${orgnr} ARKIVER` || v === `${orgnr} SLETT`;
  }, [confirm, mode, companyName, orgnr]);

  function submit() {
    setErr(null);
    setBlockers([]);
    startTransition(async () => {
      const res = await fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}/remove`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ mode, confirmation: confirm.trim(), reason: reason.trim() || null }),
      });
      const body = (await readJsonSafe(res)) as { ok?: boolean; message?: string; error?: string; data?: { mode?: string }; detail?: unknown } | null;
      if (!res.ok || body?.ok !== true) {
        setErr(parseApiMessage(body as ApiErr, "Handlingen feilet."));
        setBlockers(parseBlockers(body as ApiErr));
        return;
      }
      const doneMode = body?.data?.mode === "hard_delete" ? "hard_delete" : "archive";
      onDone({ mode: doneMode });
      onClose();
    });
  }

  if (!open || typeof document === "undefined") return null;

  const showHardDeleteTab = eligibility?.canHardDelete === true;
  const archiveOnly = eligibility != null && !eligibility.canHardDelete;

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Lukk"
        disabled={pending}
      />
      <div
        className="relative w-[min(92vw,560px)] rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-removal-title"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Firmaadministrasjon</p>
        <h2 id="company-removal-title" className="mt-1 text-lg font-semibold text-neutral-950">
          {dialogTitle}
        </h2>
        <p className="mt-2 text-sm text-neutral-700">
          <span className="font-semibold">{companyName}</span>
          {orgnr ? <span className="text-neutral-500"> · {orgnr}</span> : null}
        </p>

        {loadingEligibility ? <p className="mt-4 text-sm text-neutral-500">Henter avhengigheter…</p> : null}

        {eligibility?.protectedPilot ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Dette firmaet er beskyttet og kan ikke slettes permanent.
          </p>
        ) : null}

        {archiveOnly && eligibility.blockers.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-neutral-700">
            {eligibility.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}

        {!loadingEligibility && eligibility && !eligibility.canArchive ? (
          <p className="mt-3 text-sm text-red-700">Firma kan ikke arkiveres (allerede arkivert eller mangler org.nr).</p>
        ) : null}

        {showHardDeleteTab ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                mode === "archive" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50",
              ].join(" ")}
              onClick={() => setMode("archive")}
              disabled={!eligibility?.canArchive || pending}
            >
              Arkiver
            </button>
            <button
              type="button"
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                mode === "hard_delete" ? "bg-rose-700 text-white" : "bg-white hover:bg-neutral-50",
              ].join(" ")}
              onClick={() => setMode("hard_delete")}
              disabled={pending}
            >
              Slett permanent
            </button>
          </div>
        ) : null}

        {mode === "archive" || !showHardDeleteTab ? (
          <p className="mt-3 text-xs text-neutral-600">
            Arkivering setter firma til stengt, fjerner innlogging og beholder ordre, avtaler og audit.
          </p>
        ) : (
          <p className="mt-3 text-xs font-semibold text-rose-800">Permanent sletting kan ikke angres.</p>
        )}

        {(eligibility?.canArchive || eligibility?.canHardDelete) && !loadingEligibility ? (
          <>
            <label className="mt-4 block text-xs font-semibold text-neutral-600">
              Bekreftelse {confirmHint ? `(skriv nøyaktig: ${confirmHint})` : ""}
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                autoComplete="off"
                disabled={pending}
              />
            </label>

            <label className="mt-3 block text-xs font-semibold text-neutral-600">
              Begrunnelse (valgfritt)
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                disabled={pending}
              />
            </label>
          </>
        ) : null}

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
          {(eligibility?.canArchive && mode === "archive") || (eligibility?.canHardDelete && mode === "hard_delete") ? (
            <button
              type="button"
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50",
                mode === "hard_delete" ? "bg-rose-700 hover:bg-rose-800" : "bg-neutral-900 hover:bg-neutral-800",
              ].join(" ")}
              onClick={submit}
              disabled={
                pending ||
                !confirmMatches ||
                loadingEligibility ||
                (mode === "archive" && !eligibility?.canArchive) ||
                (mode === "hard_delete" && !eligibility?.canHardDelete)
              }
            >
              {pending ? "Utfører…" : mode === "archive" ? "Arkiver firma" : "Slett permanent"}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

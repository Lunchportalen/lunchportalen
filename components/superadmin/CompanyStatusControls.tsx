// components/superadmin/CompanyStatusControls.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DangerConfirmModal from "./DangerConfirmModal";

// ✅ FASIT for ditt alias-oppsett: app/ er allerede base for @
import { setCompanyStatus } from "@/superadmin/firms/actions";

type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED";

export default function CompanyStatusControls({
  companyId,
  companyName,
  currentStatus,
}: {
  companyId: string;
  companyName: string;
  currentStatus: CompanyStatus;
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<CompanyStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isActive = currentStatus === "ACTIVE";
  const isPaused = currentStatus === "PAUSED";
  const isClosed = currentStatus === "CLOSED";

  const modalTitle = useMemo(() => {
    if (target === "PAUSED") return "Sett firma på pause";
    if (target === "CLOSED") return "Steng firma permanent";
    if (target === "ACTIVE") return "Gjenåpne firma";
    return "Bekreft";
  }, [target]);

  const modalDescription = useMemo(() => {
    if (target === "PAUSED")
      return "Firma blir sperret på firmanivå. Ansatte kan ikke omgå sperren.";
    if (target === "CLOSED")
      return "Dette er en permanent status. Bruk kun ved kontraktsbrudd eller avslutning.";
    if (target === "ACTIVE") return "Firma åpnes igjen og får normal tilgang.";
    return "";
  }, [target]);

  const confirmText = useMemo(() => {
    if (target === "PAUSED")
      return "Dette stopper bestillinger/tilgang for firmaet kontrollert. Alle endringer logges.";
    if (target === "CLOSED")
      return "Dette er et irreversibelt steg i enterprise-praksis. Alle endringer logges.";
    if (target === "ACTIVE")
      return "Firmaet settes tilbake til aktiv drift. Alle endringer logges.";
    return "";
  }, [target]);

  function ask(next: CompanyStatus) {
    setErr(null);
    setTarget(next);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setTarget(null);
  }

  async function onConfirm() {
    if (!target) return;
    setErr(null);

    startTransition(async () => {
      try {
        await setCompanyStatus(companyId, target);
        closeModal();
        router.refresh();
      } catch (e: any) {
        setErr(e?.message || "Kunne ikke oppdatere status");
      }
    });
  }

  const dangerPhrase = (companyName ?? "").trim() || "FIRMA";

  const confirmLabel =
    target === "CLOSED" ? "Steng firma" : target === "PAUSED" ? "Sett på pause" : "Gjenåpne";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {!isClosed && (
          <button
            className="lp-btn"
            onClick={() => ask(isActive ? "PAUSED" : "ACTIVE")}
            disabled={pending}
            title={isActive ? "Sett på pause" : "Gjenåpne"}
          >
            {isActive ? "Pause" : "Gjenåpne"}
          </button>
        )}

        {!isClosed && (
          <button
            className="lp-btn-primary"
            onClick={() => ask("CLOSED")}
            disabled={pending}
            title="Steng firma"
          >
            Steng
          </button>
        )}

        {isClosed && <span className="lp-chip lp-chip-crit">Stengt</span>}
        {isPaused && !isClosed && <span className="lp-chip lp-chip-warn">På pause</span>}
        {isActive && !isClosed && <span className="lp-chip">Aktiv</span>}
      </div>

      {err && <div className="text-xs text-red-700">{err}</div>}

      <DangerConfirmModal
        open={open}
        title={modalTitle}
        description={modalDescription}
        confirmText={confirmText}
        requiredPhrase={dangerPhrase}
        confirmLabel={confirmLabel}
        cancelLabel="Avbryt"
        busy={pending}
        onCancel={() => {
          if (pending) return;
          closeModal();
        }}
        onConfirm={onConfirm}
      />
    </div>
  );
}

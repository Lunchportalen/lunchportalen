// app/superadmin/companies/[companyId]/StatusHeader.tsx
"use client";

import { useState } from "react";
import Actions, { type CompanyStatus } from "./Actions";

function pill(status: CompanyStatus) {
  if (status === "pending") return "bg-sky-50 text-sky-900 ring-1 ring-sky-200";
  if (status === "active") return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
  if (status === "paused") return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
  return "bg-zinc-100 text-zinc-900 ring-1 ring-zinc-200";
}

function label(status: CompanyStatus) {
  if (status === "pending") return "Pending";
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  return "Closed";
}

export default function StatusHeader({
  companyId,
  initialStatus,
  childrenTop,
}: {
  companyId: string;
  initialStatus: CompanyStatus;
  childrenTop: React.ReactNode;
}) {
  const [status, setStatus] = useState<CompanyStatus>(initialStatus);

  return (
    <>
      <div className="flex items-center gap-2">
        {childrenTop}
        <span className={["inline-flex items-center rounded-full px-3 py-1 text-sm ring-1", pill(status)].join(" ")}>
          {label(status)}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-6 rounded-3xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Behandle registrering</div>
        <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Pending kan kun endres av superadmin: Aktiver eller AvslÃ¥.
        </div>
        <Actions companyId={companyId} status={status} onStatusChange={setStatus} />
      </div>
    </>
  );
}

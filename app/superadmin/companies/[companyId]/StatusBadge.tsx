// STATUS: KEEP

// app/superadmin/companies/[companyId]/StatusBadge.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

export type CompanyStatus = "pending" | "active" | "paused" | "closed";

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

type StatusEventDetail = { companyId: string; status: CompanyStatus };
const EVENT_NAME = "lp-company-status";

export default function StatusBadge({
  companyId,
  initialStatus,
}: {
  companyId: string;
  initialStatus: CompanyStatus;
}) {
  const [status, setStatus] = useState<CompanyStatus>(initialStatus);

  // hvis server-rendret status endrer seg ved navigation, sync
  useEffect(() => setStatus(initialStatus), [initialStatus]);

  useEffect(() => {
    function onEvt(e: Event) {
      const ce = e as CustomEvent<StatusEventDetail>;
      const d = ce?.detail;
      if (!d) return;
      if (d.companyId !== companyId) return;
      setStatus(d.status);
    }

    window.addEventListener(EVENT_NAME, onEvt as any);
    return () => window.removeEventListener(EVENT_NAME, onEvt as any);
  }, [companyId]);

  const cls = useMemo(
    () => ["inline-flex items-center rounded-full px-3 py-1 text-sm ring-1", pill(status)].join(" "),
    [status]
  );

  return <span className={cls}>{label(status)}</span>;
}

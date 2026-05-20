"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteCustomer,
  pauseCustomer,
  resumeCustomer,
  suspendCustomer,
  type CustomerActionResult,
} from "@/app/leverandor/kunder/actions";
import SuspendDialog, { type SuspendDialogVariant } from "@/components/providers/SuspendDialog";
import type { ProviderCustomerDetail } from "@/lib/providers/loadProviderCustomerDetail";
import { providerCustomerStatusLabel } from "@/lib/providers/customerTypes";

type DialogState = {
  open: boolean;
  variant: SuspendDialogVariant;
};

function statusBadgeClass(status: ProviderCustomerDetail["company"]["status"]) {
  if (status === "ACTIVE") return "ds-provider-status-badge ds-provider-status-badge--active";
  if (status === "PAUSED") return "ds-provider-status-badge ds-provider-status-badge--paused";
  if (status === "SUSPENDED") return "ds-provider-status-badge ds-provider-status-badge--suspended";
  return "ds-provider-status-badge ds-provider-status-badge--deleted";
}

export default function CustomerDetailClient({
  detail,
  canManage,
}: {
  detail: ProviderCustomerDetail;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>({ open: false, variant: "suspend" });
  const [error, setError] = useState<string | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useState(detail.company.status);

  const company = detail.company;
  const displayStatus = optimisticStatus;
  const isSuspended = displayStatus === "SUSPENDED" || Boolean(company.suspendedAt);
  const isPaused = displayStatus === "PAUSED" || Boolean(company.pausedAt);
  const isDeleted = displayStatus === "DELETED" || Boolean(company.deletedAt);

  async function runAction(
    variant: SuspendDialogVariant,
    reason?: string,
  ): Promise<CustomerActionResult> {
    if (variant === "suspend") return suspendCustomer(company.id, reason ?? "");
    if (variant === "pause") return pauseCustomer(company.id, reason ?? "");
    if (variant === "delete") return deleteCustomer(company.id, reason ?? "");
    return resumeCustomer(company.id);
  }

  function optimisticFor(variant: SuspendDialogVariant) {
    if (variant === "suspend") return "SUSPENDED" as const;
    if (variant === "pause") return "PAUSED" as const;
    if (variant === "delete") return "DELETED" as const;
    return "ACTIVE" as const;
  }

  function handleConfirm(reason?: string) {
    const variant = dialog.variant;
    const prev = optimisticStatus;
    setOptimisticStatus(optimisticFor(variant));
    setError(null);

    startTransition(async () => {
      const res = await runAction(variant, reason);
      if (!res.success) {
        setOptimisticStatus(prev);
        setError("error" in res ? res.error : "Handlingen feilet.");
        return;
      }
      setDialog({ open: false, variant });
      router.refresh();
    });
  }

  return (
    <>
      <header className="ds-provider-topbar">
        <div>
          <p className="ds-eyebrow">Kunde</p>
          <h1 className="ds-h2">{company.name}</h1>
          <span className={statusBadgeClass(displayStatus)}>{providerCustomerStatusLabel(displayStatus)}</span>
        </div>
      </header>

      {isSuspended || isPaused ? (
        <section className="ds-section ds-cta-band ds-cta-band--theme-dark" role="status">
          <p className="ds-body">
            {isSuspended
              ? company.suspendedReason || "Kunden er suspendert."
              : company.pausedReason || "Kunden er pauset."}
          </p>
        </section>
      ) : null}

      <div className="ds-admin-kpi-row ds-section">
        <div className="ds-admin-kpi">
          <div className="ds-admin-kpi__label">Ansatte</div>
          <div className="ds-admin-kpi__value">{detail.stats.employeesCount}</div>
        </div>
        <div className="ds-admin-kpi">
          <div className="ds-admin-kpi__label">Aktive ordrer</div>
          <div className="ds-admin-kpi__value">{detail.stats.activeOrdersCount}</div>
        </div>
        <div className="ds-admin-kpi">
          <div className="ds-admin-kpi__label">Omsetning 30 dager</div>
          <div className="ds-admin-kpi__value">
            {new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(
              detail.stats.monthlyRevenueNok,
            )}
          </div>
        </div>
      </div>

      <div className="ds-provider-action-bar">
        <button
          type="button"
          className="ds-btn ds-btn--ghost"
          disabled={!canManage || pending || isDeleted}
          onClick={() => setDialog({ open: true, variant: "pause" })}
        >
          Pause
        </button>
        <button
          type="button"
          className="ds-btn ds-btn--ghost"
          disabled={!canManage || pending || isDeleted}
          onClick={() => setDialog({ open: true, variant: "suspend" })}
        >
          Suspender
        </button>
        <button
          type="button"
          className="ds-btn ds-btn--ghost"
          disabled={!canManage || pending || isDeleted}
          onClick={() => setDialog({ open: true, variant: "delete" })}
        >
          Slett
        </button>
        <button
          type="button"
          className="ds-btn ds-btn--primary"
          disabled={!canManage || pending || (!isSuspended && !isPaused && !isDeleted)}
          onClick={() => setDialog({ open: true, variant: "resume" })}
        >
          Gjenopprett
        </button>
      </div>

      {!canManage ? (
        <p className="ds-body ds-section">Du har lesetilgang. Handlinger krever provider-admin.</p>
      ) : null}

      <section className="ds-section">
        <h2 className="ds-h2">Ansatte</h2>
        <p className="ds-body">Kommer i Patch 11.</p>
      </section>

      <section className="ds-section">
        <h2 className="ds-h2">Avtaler</h2>
        {detail.agreements.length === 0 ? (
          <p className="ds-body">Ingen avtaler registrert.</p>
        ) : (
          <ul className="ds-provider-activity">
            {detail.agreements.map((a) => (
              <li key={a.id} className="ds-provider-activity__row">
                <span className="ds-provider-activity__action">{a.status}</span>
                <span className="ds-provider-activity__meta">{a.createdAt ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ds-section">
        <h2 className="ds-h2">Ordrer</h2>
        {detail.orders.length === 0 ? (
          <p className="ds-body">Ingen ordrer.</p>
        ) : (
          <ul className="ds-provider-activity">
            {detail.orders.map((o) => (
              <li key={o.id} className="ds-provider-activity__row">
                <span className="ds-provider-activity__action">
                  {o.date} · {o.status}
                </span>
                <span className="ds-provider-activity__meta">
                  {o.lineTotal != null
                    ? new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK" }).format(o.lineTotal)
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ds-section">
        <h2 className="ds-h2">Aktivitet</h2>
        {detail.activity.length === 0 ? (
          <p className="ds-body">Ingen hendelser.</p>
        ) : (
          <div className="ds-provider-activity">
            {detail.activity.map((row) => (
              <article key={row.id} className="ds-provider-activity__row">
                <div className="ds-provider-activity__action">
                  {row.action} · {row.entityType}
                </div>
                <div className="ds-provider-activity__meta">{row.createdAt}</div>
                {row.reason ? <p className="ds-body ds-provider-activity__meta--desktop">{row.reason}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <SuspendDialog
        open={dialog.open}
        variant={dialog.variant}
        entityName={company.name}
        loading={pending}
        error={error}
        onCancel={() => {
          if (!pending) {
            setDialog((d) => ({ ...d, open: false }));
            setError(null);
          }
        }}
        onConfirm={handleConfirm}
      />
    </>
  );
}

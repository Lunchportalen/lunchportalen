"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { advanceKitchenOrder } from "@/app/leverandor/ordrer/actions";
import { formatDateNO } from "@/lib/date/format";
import {
  kitchenStatusLabelKey,
  kitchenStatusPillClass,
  nextKitchenTarget,
  targetActionLabelKey,
  type KitchenOrderStatus,
} from "@/lib/providers/kitchenOrderStatus";
import { resolveProviderOrdersActionError } from "@/lib/providers/providerOrdersActionErrors";
import type { KitchenOrderRow } from "@/lib/providers/loadKitchenOrders";

export default function KitchenOrderCard({
  order,
  canAdvance,
}: {
  order: KitchenOrderRow;
  canAdvance: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState<KitchenOrderStatus>(order.status);
  const [error, setError] = useState<string | null>(null);
  const tStatus = useTranslations("provider.orders.status");
  const tActions = useTranslations("provider.orders.actions");
  const tCard = useTranslations("provider.orders.card");
  const tErrors = useTranslations("provider.orders.errors");

  const row = order;
  const target = nextKitchenTarget(optimisticStatus);
  const isNew = optimisticStatus === "ACTIVE" || optimisticStatus === "LOCKED";

  function onAdvance() {
    if (!target || !canAdvance) return;
    const prev = optimisticStatus;
    setOptimisticStatus(
      target === "PREPARED" ? "PREPARED" : target === "DISPATCHED" ? "DISPATCHED" : "DELIVERED",
    );
    setError(null);

    startTransition(async () => {
      const res = await advanceKitchenOrder(row.id, target);
      if (res.success === false) {
        setOptimisticStatus(prev);
        setError(resolveProviderOrdersActionError(tErrors, res));
        return;
      }
      router.refresh();
    });
  }

  return (
    <article
      className={`ds-provider-order-card${isNew ? " is-new" : ""}${pending ? " is-pending" : ""}`}
      aria-busy={pending}
    >
      <header className="ds-provider-order-card__head">
        <div>
          <h3 className="ds-provider-order-card__title">{row.companyName}</h3>
          <p className="ds-provider-order-card__meta">
            {row.locationName ? `${row.locationName} · ` : ""}
            {formatDateNO(row.date) || row.date}
            {row.slot ? ` · ${row.slot}` : ""}
          </p>
          <p className="ds-provider-order-card__meta">
            {row.employeeDisplayName}
            {row.employeeEmail ? ` · ${row.employeeEmail}` : ""}
          </p>
        </div>
        <span className={kitchenStatusPillClass(optimisticStatus)}>{tStatus(kitchenStatusLabelKey(optimisticStatus))}</span>
      </header>

      <ul className="ds-provider-order-card__items">
        {row.items.length === 0 ? (
          <li className="ds-body">{tCard("noLines")}</li>
        ) : (
          row.items.map((item, idx) => (
            <li key={`${row.id}-${idx}`}>
              <div>
                {tCard("lineQuantity", { quantity: item.quantity, displayLine: item.displayLine })}
              </div>
              {item.allergens.length ? (
                <div className="ds-body text-[rgb(var(--lp-muted))]">
                  {tCard("allergensPrefix", { list: item.allergens.join(", ") })}
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {row.note ? (
        <p className="ds-provider-order-card__note">
          <strong>{tCard("noteLabel")}</strong> {row.note}
        </p>
      ) : null}

      {error ? (
        <p className="lp-demo-form__status is-error" role="alert">
          {error}
        </p>
      ) : null}

      {target && canAdvance ? (
        <button type="button" className="ds-btn ds-btn--primary ds-provider-order-card__action" disabled={pending} onClick={onAdvance}>
          {pending ? tActions("saving") : tActions(targetActionLabelKey(target))}
        </button>
      ) : null}

      {!canAdvance ? <p className="ds-provider-activity__meta">{tCard("readOnlyNote")}</p> : null}
    </article>
  );
}

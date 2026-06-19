"use client";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import { PACKAGE_CARD_COPY, PACKAGE_WARM_DISH_HELPER } from "@/lib/provider-menu/providerMenuWorkspace";
import { formatPriceExVatLabel, formatPriceIncVatLabel } from "@/lib/providers/providerMenuPriceDisplay";
import type { ProviderMenuPriceView } from "@/lib/providers/providerMenuPriceDisplay";
import { PLAN_TIERS } from "@/lib/cms/menuDayContract";

type Props = {
  tier: PlanTier;
  weekStatus: string;
  statusChipClass: string;
  weekStart: string;
  prices: Record<PlanTier, ProviderMenuPriceView> | null;
  onTierChange: (tier: PlanTier) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  workspaceView: "week" | "catalog";
  onWorkspaceViewChange: (view: "week" | "catalog") => void;
  nextStepHint: string;
};

const TIER_ORDER = PLAN_TIERS;

export default function ProviderMenuCommandHeader({
  tier,
  weekStatus,
  statusChipClass,
  weekStart,
  prices,
  onTierChange,
  onPrevWeek,
  onNextWeek,
  workspaceView,
  onWorkspaceViewChange,
  nextStepHint,
}: Props) {
  return (
    <header className="menu-command-header">
      <div className="menu-command-header__top">
        <div className="menu-command-header__identity">
          <h2 className="menu-command-header__title">Meny</h2>
          <p className="menu-command-header__subtitle">Planlegg uke · publiser dag for dag</p>
          <div className="menu-command-header__status-row">
            <span className={`menu-command-header__status-chip ${statusChipClass}`} role="status">
              {weekStatus}
            </span>
            <span className="menu-command-header__next-step">{nextStepHint}</span>
          </div>
        </div>
        <div className="menu-command-header__week-nav">
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onPrevWeek}>
            Forrige uke
          </button>
          <span className="menu-command-header__week-label">Uke fra {weekStart}</span>
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onNextWeek}>
            Neste uke
          </button>
        </div>
      </div>

      <div className="menu-command-header__packages" role="tablist" aria-label="Menypakker">
        {TIER_ORDER.map((t) => {
          const copy = PACKAGE_CARD_COPY[t];
          const price = prices?.[t];
          const active = tier === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              className={`menu-package-card${active ? " is-active" : ""}`}
              onClick={() => onTierChange(t)}
            >
              <span className="menu-package-card__title">{copy.title}</span>
              <span className="menu-package-card__includes">{copy.includes}</span>
              <span className="menu-package-card__price">
                {price
                  ? `${formatPriceExVatLabel(price.priceExVatNok)} · ${formatPriceIncVatLabel(price.priceIncVatNok)}`
                  : copy.priceHint}
              </span>
            </button>
          );
        })}
      </div>

      <p className="menu-command-header__helper">{PACKAGE_WARM_DISH_HELPER}</p>

      <div className="menu-command-header__views" role="tablist" aria-label="Workspace">
        <button
          type="button"
          role="tab"
          aria-selected={workspaceView === "week"}
          className={`menu-command-header__view-tab${workspaceView === "week" ? " is-active" : ""}`}
          onClick={() => onWorkspaceViewChange("week")}
        >
          Ukeplanlegger
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={workspaceView === "catalog"}
          className={`menu-command-header__view-tab${workspaceView === "catalog" ? " is-active" : ""}`}
          onClick={() => onWorkspaceViewChange("catalog")}
        >
          Menykatalog
        </button>
      </div>
    </header>
  );
}

"use client";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import { PLAN_TIERS } from "@/lib/cms/menuDayContract";
import { weekHeadingFromMondayStart } from "@/lib/date/week";
import { PRODUCTION_RULE_TEXT } from "@/lib/provider-menu/providerMenuWorkspace";
import {
  formatPriceExVatLabel,
  formatPriceIncVatLabel,
  type ProviderMenuPriceView,
} from "@/lib/providers/providerMenuPriceDisplay";

type Props = {
  tier: PlanTier;
  weekStart: string;
  prices: Record<PlanTier, ProviderMenuPriceView> | null;
  onTierChange: (tier: PlanTier) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  workspaceView: "week" | "catalog";
  onWorkspaceViewChange: (view: "week" | "catalog") => void;
};

const TIER_LABELS: Record<PlanTier, string> = {
  BASIS: "Basis",
  LUXUS: "Luxus",
  ENTERPRISE: "Enterprise",
};

export default function ProviderMenuCommandHeader({
  tier,
  weekStart,
  prices,
  onTierChange,
  onPrevWeek,
  onNextWeek,
  workspaceView,
  onWorkspaceViewChange,
}: Props) {
  const tierPrice = prices?.[tier];
  const vatPct =
    tierPrice && tierPrice.priceExVatNok > 0
      ? Math.round(tierPrice.vatRate * 100)
      : 15;

  return (
    <header className="lp-editor-command-header">
      <div className="lp-editor-page-head">
        <div className="lp-editor-page-head__main">
          <p className="lp-editor-page-head__eyebrow">Meny · ukeplanlegger</p>
          <h1 className="lp-editor-page-head__title">{weekHeadingFromMondayStart(weekStart)}</h1>
          <p className="lp-editor-page-head__lead">
            Felles varmrett genereres automatisk. Du redigerer det du vil.
          </p>
          <div className="lp-editor-page-head__week-nav">
            <button type="button" className="ds-btn ds-btn--ghost" onClick={onPrevWeek}>
              ← Forrige
            </button>
            <button type="button" className="ds-btn ds-btn--ghost" onClick={onNextWeek}>
              Neste →
            </button>
          </div>
        </div>

        <div className="lp-editor-tier-lens" role="tablist" aria-label="Menypakker">
          {PLAN_TIERS.map((t) => {
            const price = prices?.[t];
            const active = tier === t;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                className={`lp-editor-tier-lens__btn${active ? " is-active" : ""}`}
                onClick={() => onTierChange(t)}
              >
                {TIER_LABELS[t]}
                <small>
                  {price ? `${price.priceExVatNok} kr` : "—"}
                </small>
              </button>
            );
          })}
        </div>
      </div>

      {tierPrice ? (
        <div className="lp-editor-priceline" aria-label="Tier-pris">
          <div className="lp-editor-priceline__ex">
            {formatPriceExVatLabel(tierPrice.priceExVatNok)}{" "}
            <span>eks. mva</span>
          </div>
          <div className="lp-editor-priceline__inc">
            {formatPriceIncVatLabel(tierPrice.priceIncVatNok)} inkl. mva ({vatPct} %)
          </div>
          <p className="lp-editor-priceline__rule">
            <span className="lp-editor-priceline__rule-icon" aria-hidden="true">🍽</span>
            {PRODUCTION_RULE_TEXT}
          </p>
        </div>
      ) : null}

      <div className="lp-editor-command-header__views" role="tablist" aria-label="Workspace">
        <button
          type="button"
          role="tab"
          aria-selected={workspaceView === "week"}
          className={`lp-editor-command-header__view-tab${workspaceView === "week" ? " is-active" : ""}`}
          onClick={() => onWorkspaceViewChange("week")}
        >
          Ukeplan
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={workspaceView === "catalog"}
          className={`lp-editor-command-header__view-tab${workspaceView === "catalog" ? " is-active" : ""}`}
          onClick={() => onWorkspaceViewChange("catalog")}
        >
          Menykatalog
        </button>
      </div>
    </header>
  );
}

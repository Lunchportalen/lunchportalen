"use client";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import { PLAN_TIERS } from "@/lib/cms/menuDayContract";
import { weekHeadingFromMondayStart } from "@/lib/date/week";
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

  return (
    <header className="lp-editor-command-header">
      <div className="lp-editor-page-head">
        <div className="lp-editor-page-head__main">
          <p className="lp-editor-page-head__eyebrow">Meny-editor</p>
          <h1 className="lp-editor-page-head__title">{weekHeadingFromMondayStart(weekStart)}</h1>
          <p className="lp-editor-page-head__lead">
            Planlegg uke, sett dagens felles varmrett og publiser for bestilling.
          </p>
        </div>

        <div className="lp-editor-page-head__week-nav-pill" aria-label="Ukenavigasjon">
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onPrevWeek}>
            ← Forrige
          </button>
          <span className="lp-editor-page-head__week-label">Uke fra {weekStart}</span>
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onNextWeek}>
            Neste →
          </button>
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
                <small>{price ? `${price.priceExVatNok} kr` : "—"}</small>
              </button>
            );
          })}
        </div>
      </div>

      {tierPrice ? (
        <p className="lp-editor-priceline-compact" aria-label="Tier-pris og produksjonsregel">
          <strong>{TIER_LABELS[tier]}</strong>
          {" · "}
          {formatPriceExVatLabel(tierPrice.priceExVatNok).replace(" kr eks. mva", " eks")}
          {" / "}
          {formatPriceIncVatLabel(tierPrice.priceIncVatNok).replace(" kr inkl. mva", " inkl mva")}
          {". Varmretten er felles for alle tre nivåene."}
        </p>
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

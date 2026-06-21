"use client";

import type { PlanTier } from "@/lib/cms/menuDayContract";
import {
  PACKAGE_CARD_COPY,
  PRODUCTION_RULE_TEXT,
  PRODUCTION_RULE_TITLE,
} from "@/lib/provider-menu/providerMenuWorkspace";
import { formatPriceExVatLabel, formatPriceIncVatLabel } from "@/lib/providers/providerMenuPriceDisplay";
import type { ProviderMenuPriceView } from "@/lib/providers/providerMenuPriceDisplay";
import { PLAN_TIERS } from "@/lib/cms/menuDayContract";

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

const TIER_ORDER = PLAN_TIERS;

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
  return (
    <header className="lp-editor-command-header">
      <div className="lp-editor-command-header__top">
        <div className="lp-editor-command-header__identity">
          <h2 className="lp-editor-command-header__title">Ukeplanlegger</h2>
          <p className="lp-editor-command-header__subtitle">Planlegg · kontroller · publiser</p>
        </div>
        <div className="lp-editor-command-header__week-nav">
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onPrevWeek}>
            ← Forrige
          </button>
          <span className="lp-editor-command-header__week-label">Uke fra {weekStart}</span>
          <button type="button" className="ds-btn ds-btn--ghost" onClick={onNextWeek}>
            Neste →
          </button>
        </div>
      </div>

      <aside className="lp-editor-production-rule" aria-label="Produksjonsregel">
        <span className="lp-editor-production-rule__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="currentColor"
              d="M12 2 3 7v6c0 5 3.8 9.7 9 11 5.2-1.3 9-6 9-11V7l-9-5Zm0 11.5a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Zm0-6.25a1.25 1.25 0 0 0-1.24 1.4L11.5 14h1l.24-5.35A1.25 1.25 0 0 0 12 7.25Z"
            />
          </svg>
        </span>
        <div className="lp-editor-production-rule__body">
          <h3 className="lp-editor-production-rule__title">{PRODUCTION_RULE_TITLE}</h3>
          <p className="lp-editor-production-rule__text">{PRODUCTION_RULE_TEXT}</p>
        </div>
      </aside>

      <div className="lp-editor-command-header__packages" role="tablist" aria-label="Menypakker">
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
              className={`lp-editor-package-card${active ? " is-active" : ""}`}
              onClick={() => onTierChange(t)}
            >
              <span className="lp-editor-package-card__label">{copy.title}</span>
              <span className="lp-editor-package-card__role">{copy.role}</span>
              <span className="lp-editor-package-card__includes">{copy.includes}</span>
              {copy.badge ? (
                <span className="lp-editor-package-card__badge lp-editor-package-card__badge--rule">{copy.badge}</span>
              ) : null}
              <span className="lp-editor-package-card__price">
                {price
                  ? `${formatPriceExVatLabel(price.priceExVatNok)} · ${formatPriceIncVatLabel(price.priceIncVatNok)}`
                  : copy.priceHint}
              </span>
            </button>
          );
        })}
      </div>

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

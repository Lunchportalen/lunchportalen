"use client";

import { useEffect, useState } from "react";
import type { PlanTier } from "@/lib/cms/menuDayContract";
import type { ResolvedProviderMenuSlot } from "@/lib/provider-menu/mergeProviderMenuSlots";
import {
  ENTERPRISE_UPGRADE_LABELS,
  ENTERPRISE_UPGRADE_TYPES,
  type EnterpriseUpgradeType,
  type EnterpriseValidationWarning,
  type MarginEstimate,
} from "@/lib/providers/providerMenuPackageSurface";
import { formatPriceExVatLabel } from "@/lib/providers/providerMenuPriceDisplay";
import type { EditorContext, EditorFocus } from "@/lib/provider-menu/providerMenuWorkspace";
import {
  ENTERPRISE_DEFAULT_SUGGESTION,
  ENTERPRISE_UPGRADE_QUICK_CHOICES,
  applyEnterpriseUpgradePreset,
  enterpriseUpgradeHasContent,
} from "@/lib/provider-menu/providerMenuWorkspace";
import { isSanityDrivenCategory } from "@/lib/provider-menu/providerMenuTierContract";

const TIER_SOURCE_LABELS: Record<PlanTier, string> = {
  BASIS: "Basis",
  LUXUS: "Luxus",
  ENTERPRISE: "Enterprise",
};

const LUXUS_PRICE_EX_VAT = 130;
const ENTERPRISE_PRICE_EX_VAT = 170;

type Props = {
  open: boolean;
  context: EditorContext | null;
  form: ResolvedProviderMenuSlot | null;
  categoryVariantLabels?: string[];
  categoryOnly?: boolean;
  onFormChange: (next: ResolvedProviderMenuSlot) => void;
  onClose: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onCopyFromBasis: () => void;
  onCopyFromLuxus: () => void;
  pending: boolean;
  margin: MarginEstimate | null;
  enterpriseWarnings: EnterpriseValidationWarning[];
  confirmWarnings: boolean;
  onConfirmWarningsChange: (v: boolean) => void;
  catalogVariantAllergens?: string[];
  imageUrl?: string | null;
  tier: PlanTier;
  editorFocus?: EditorFocus;
  sharedVarmrettTitle?: string | null;
  varmrettProviderOverride?: boolean;
  varmrettAutoFilled?: boolean;
  varmrettHasGeneratedBaseline?: boolean;
  varmrettOrderLocked?: boolean;
  varmrettOrderCount?: number;
  onResetToGenerated?: () => void;
};

function slotStatusBadge(status: ResolvedProviderMenuSlot["status"]): string {
  if (status === "published") return "Publisert";
  if (status === "draft") return "Utkast";
  return "Ikke publisert";
}

function slotStatusClass(status: ResolvedProviderMenuSlot["status"]): string {
  if (status === "published") return "is-published";
  if (status === "draft") return "is-draft";
  return "is-neutral";
}

export default function ProviderMenuEditorPanel({
  open,
  context,
  form,
  categoryVariantLabels,
  categoryOnly,
  onFormChange,
  onClose,
  onSaveDraft,
  onPublish,
  onCopyFromBasis,
  onCopyFromLuxus,
  pending,
  margin,
  enterpriseWarnings,
  confirmWarnings,
  onConfirmWarningsChange,
  catalogVariantAllergens,
  imageUrl,
  tier,
  editorFocus,
  sharedVarmrettTitle,
  varmrettProviderOverride,
  varmrettAutoFilled,
  varmrettHasGeneratedBaseline,
  varmrettOrderLocked,
  varmrettOrderCount = 0,
  onResetToGenerated,
}: Props) {
  const [showManualEditing, setShowManualEditing] = useState(false);

  useEffect(() => {
    if (!open || !form || !context) return;
    const isEnterprise = (editorFocus ?? context.editorFocus) === "enterprise-upgrade";
    if (isEnterprise) {
      setShowManualEditing(enterpriseUpgradeHasContent(form));
    }
  }, [open, context?.date, context?.editorFocus, editorFocus, form?.upgradeType, form?.upgradeNote]);

  if (!open || !form || !context) {
    return (
      <aside className="lp-editor-inspector lp-editor-inspector--idle" aria-label="Redigeringspanel" data-state="closed">
        <div className="lp-editor-inspector__empty">
          <p className="lp-editor-inspector__empty-title">Velg en dag</p>
          <p className="lp-editor-inspector__empty-lead">Klikk varmrett eller valg i ukeplanen.</p>
        </div>
      </aside>
    );
  }

  const focus = editorFocus ?? context.editorFocus;
  const isEnterpriseUpgradeMode = focus === "enterprise-upgrade";
  const isVarmrettMode = isSanityDrivenCategory(form.category) && !isEnterpriseUpgradeMode;
  const isCatalogMode = !isVarmrettMode && !isEnterpriseUpgradeMode && (context.mode === "catalog" || categoryOnly);

  const isFriday = context.weekdayLabel.toLowerCase().startsWith("fredag");

  const enterpriseDelta = ENTERPRISE_PRICE_EX_VAT - LUXUS_PRICE_EX_VAT;
  const luxusMargin =
    margin?.estimatedCostNok != null
      ? Math.round((LUXUS_PRICE_EX_VAT - margin.estimatedCostNok) * 100) / 100
      : null;
  const extraMargin =
    margin?.grossMarginNok != null && luxusMargin != null
      ? Math.round((margin.grossMarginNok - luxusMargin) * 100) / 100
      : null;

  const headerSecondary = isEnterpriseUpgradeMode
    ? "Enterprise-upgrade på dagens Varmrett"
    : isVarmrettMode
      ? "Dagens felles Varmrett"
      : context.categoryLabel;

  const applyDefaultSuggestion = () => {
    onFormChange(
      applyEnterpriseUpgradePreset(form, {
        upgradeType: ENTERPRISE_DEFAULT_SUGGESTION.upgradeType,
        upgradeNote: ENTERPRISE_DEFAULT_SUGGESTION.upgradeNote,
        sourcePackage: ENTERPRISE_DEFAULT_SUGGESTION.sourcePackage,
      }),
    );
  };

  const applyQuickChoice = (choice: (typeof ENTERPRISE_UPGRADE_QUICK_CHOICES)[number]) => {
    onFormChange(
      applyEnterpriseUpgradePreset(form, {
        upgradeType: choice.upgradeType,
        upgradeNote: choice.upgradeNote,
        sourcePackage: "LUXUS",
      }),
    );
  };

  const hasUpgradeContent = enterpriseUpgradeHasContent(form);
  const showSuggestionCard = isEnterpriseUpgradeMode && !showManualEditing && !hasUpgradeContent;
  const varmrettSaveBlocked = isVarmrettMode && varmrettOrderLocked;

  return (
    <aside className="lp-editor-inspector is-open" aria-label="Redigeringspanel">
      <header className="lp-editor-inspector__head">
        <div>
          <h3 className="lp-editor-inspector__context">Rediger {context.weekdayLabel}</h3>
          <p className="lp-editor-inspector__subtitle">{headerSecondary}</p>
          <span className={`lp-editor-inspector__status-badge ${slotStatusClass(form.status)}`}>
            {slotStatusBadge(form.status)}
          </span>
          {varmrettAutoFilled && !varmrettProviderOverride && !varmrettOrderLocked ? (
            <span className={`lp-editor-badge${isFriday ? " is-friday" : " is-generated"}`}>
              {isFriday ? "Fredagskos" : "Generert"}
            </span>
          ) : null}
          {varmrettProviderOverride && !varmrettOrderLocked ? (
            <span className="lp-editor-badge is-overridden">Overstyrt</span>
          ) : null}
        </div>
        <button type="button" className="ds-btn ds-btn--ghost lp-editor-inspector__close" onClick={onClose}>
          Lukk
        </button>
      </header>

      {isCatalogMode && categoryOnly && categoryVariantLabels && categoryVariantLabels.length > 0 ? (
        <section className="lp-editor-inspector__section">
          <h4 className="lp-editor-inspector__section-title">Faste valg</h4>
          <p className="lp-editor-inspector__note">Katalogstyrte valg — publiser kategorien for denne dagen.</p>
          <ul className="lp-editor-inspector__variant-list">
            {categoryVariantLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
          {catalogVariantAllergens && catalogVariantAllergens.length > 0 ? (
            <p className="lp-editor-inspector__meta">Allergener: {catalogVariantAllergens.join(", ")}</p>
          ) : null}
        </section>
      ) : null}

      {isVarmrettMode ? (
        <section className="lp-editor-inspector__section lp-editor-inspector__section--varmrett">
          {varmrettOrderLocked ? (
            <div className="lp-editor-inspector__order-lock-wrap" role="status">
              <p className="lp-editor-order-lock lp-editor-inspector__order-lock">
                <span className="lp-editor-order-lock__icon" aria-hidden="true">🔒</span>
                <span className="lp-editor-order-lock__text">Har bestilling</span>
              </p>
              {varmrettOrderCount > 0 ? (
                <p className="lp-editor-inspector__order-count">
                  {varmrettOrderCount} ansatte har bestilt
                </p>
              ) : null}
              <p className="lp-editor-inspector__lock-hint">Åpnes etter serveringsdagen</p>
            </div>
          ) : null}
          <div className="lp-editor-inspector__varmrett-hero">
            <span className="lp-editor-inspector__varmrett-hero-label">Dagens varmrett</span>
            <p className="lp-editor-inspector__varmrett-hero-title">
              {form.mealTitle.trim() || "Legg inn rettens navn"}
            </p>
            <p className="lp-editor-inspector__shared-lead">
              Felles kjøkkenrett for Basis, Luxus og Enterprise denne dagen.
            </p>
          </div>
          <label className="lp-editor-inspector__field">
            Rettens navn
            <input
              value={form.mealTitle}
              disabled={varmrettOrderLocked}
              onChange={(e) => onFormChange({ ...form, mealTitle: e.target.value })}
              maxLength={120}
            />
          </label>
          <label className="lp-editor-inspector__field">
            Beskrivelse
            <textarea
              rows={3}
              value={form.description}
              disabled={varmrettOrderLocked}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              maxLength={4000}
            />
          </label>
          <label className="lp-editor-inspector__field">
            Allergener
            <input
              value={form.allergensText}
              disabled={varmrettOrderLocked}
              onChange={(e) => onFormChange({ ...form, allergensText: e.target.value })}
              placeholder="F.eks. melk, hvete"
            />
          </label>
          <label className="lp-editor-inspector__field">
            Estimert råvarekost (kr)
            <input
              type="number"
              min={0}
              max={200}
              step={0.5}
              disabled={varmrettOrderLocked}
              value={form.estimatedCostPerPortion ?? ""}
              onChange={(e) =>
                onFormChange({
                  ...form,
                  estimatedCostPerPortion: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          {varmrettHasGeneratedBaseline && onResetToGenerated && !varmrettOrderLocked ? (
            <button
              type="button"
              className="ds-btn ds-btn--ghost lp-editor-inspector__reset-baseline"
              disabled={pending}
              onClick={onResetToGenerated}
            >
              Tilbakestill til generert
            </button>
          ) : null}
        </section>
      ) : null}

      {isCatalogMode && !categoryOnly && context.variantLabel ? (
        <section className="lp-editor-inspector__section">
          <h4 className="lp-editor-inspector__section-title">Fast valg</h4>
          <p className="lp-editor-inspector__readonly-value">{context.variantLabel}</p>
          <p className="lp-editor-inspector__note">Katalogstyrt — publiser kategorien for å aktivere.</p>
        </section>
      ) : null}

      {!isVarmrettMode && !isCatalogMode && !isEnterpriseUpgradeMode ? (
        <section className="lp-editor-inspector__section">
          <h4 className="lp-editor-inspector__section-title">Innhold</h4>
          <label className="lp-editor-inspector__field">
            Rettens navn
            <input
              value={form.mealTitle}
              onChange={(e) => onFormChange({ ...form, mealTitle: e.target.value })}
              maxLength={120}
            />
          </label>
          <label className="lp-editor-inspector__field">
            Beskrivelse
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              maxLength={4000}
            />
          </label>
        </section>
      ) : null}

      {imageUrl ? <img src={imageUrl} alt="" className="lp-editor-inspector__thumb" /> : null}

      {margin && !isEnterpriseUpgradeMode ? (
        <section className="lp-editor-inspector__section lp-editor-inspector__section--economy">
          <h4 className="lp-editor-inspector__section-title">Økonomi</h4>
          <div className="lp-editor-inspector__economy-grid">
            <div className="lp-editor-inspector__kpi">
              <span className="lp-editor-inspector__kpi-label">Pris eks. mva</span>
              <span className="lp-editor-inspector__kpi-value">{formatPriceExVatLabel(margin.priceExVatNok)}</span>
            </div>
            {margin.estimatedCostNok != null ? (
              <>
                <div className="lp-editor-inspector__kpi">
                  <span className="lp-editor-inspector__kpi-label">Estimert kost</span>
                  <span className="lp-editor-inspector__kpi-value">
                    {margin.estimatedCostNok.toLocaleString("nb-NO")} kr
                  </span>
                </div>
                <div className="lp-editor-inspector__kpi">
                  <span className="lp-editor-inspector__kpi-label">Dekningsbidrag</span>
                  <span className="lp-editor-inspector__kpi-value">
                    {margin.grossMarginNok?.toLocaleString("nb-NO") ?? "—"} kr
                    {margin.marginPercent != null ? ` (${margin.marginPercent} %)` : ""}
                  </span>
                </div>
              </>
            ) : (
              <p className="lp-editor-inspector__note">Legg inn råvarekost for marginberegning.</p>
            )}
          </div>
        </section>
      ) : null}

      {isEnterpriseUpgradeMode ? (
        <section className="lp-editor-inspector__section lp-editor-inspector__section--enterprise lp-editor-enterprise">
          <div className="lp-editor-inspector__enterprise-header">
            <h4 className="lp-editor-inspector__section-title">Enterprise-upgrade</h4>
            <p className="lp-editor-inspector__enterprise-lead">
              Ekstra verdi – samme Varmrett. Ingen ny produksjonsrett.
            </p>
          </div>

          <div className="lp-editor-inspector__enterprise-varmrett-card">
            <span className="lp-editor-inspector__enterprise-base-label">Dagens Varmrett</span>
            {sharedVarmrettTitle ? (
              <p className="lp-editor-inspector__enterprise-base-title">{sharedVarmrettTitle}</p>
            ) : (
              <p className="lp-editor-inspector__warn">Dagens Varmrett mangler — legg inn Varmrett først.</p>
            )}
            <p className="lp-editor-inspector__enterprise-varmrett-note">
              Enterprise bygger på samme Varmrett – uten ny produksjonsrett.
            </p>
          </div>

          <div className="lp-editor-inspector__enterprise-kpis">
            <div className="lp-editor-inspector__kpi">
              <span className="lp-editor-inspector__kpi-label">Merpris</span>
              <span className="lp-editor-inspector__kpi-value">+{enterpriseDelta} kr</span>
            </div>
            {margin?.estimatedCostNok != null ? (
              <div className="lp-editor-inspector__kpi">
                <span className="lp-editor-inspector__kpi-label">Est. råvarekost</span>
                <span className="lp-editor-inspector__kpi-value">{margin.estimatedCostNok} kr</span>
              </div>
            ) : null}
            {extraMargin != null ? (
              <div className="lp-editor-inspector__kpi">
                <span className="lp-editor-inspector__kpi-label">Ekstra dekningsbidrag</span>
                <span className="lp-editor-inspector__kpi-value">{extraMargin} kr</span>
              </div>
            ) : null}
          </div>

          {showSuggestionCard ? (
            <div className="lp-editor-inspector__enterprise-suggestion">
              <span className="lp-editor-inspector__enterprise-suggestion-label">Foreslått Enterprise-upgrade</span>
              <p className="lp-editor-inspector__enterprise-suggestion-title">{ENTERPRISE_DEFAULT_SUGGESTION.title}</p>
              <p className="lp-editor-inspector__enterprise-suggestion-lead">{ENTERPRISE_DEFAULT_SUGGESTION.explanation}</p>
              <div className="lp-editor-inspector__enterprise-suggestion-actions">
                <button
                  type="button"
                  className="ds-btn ds-btn--primary"
                  onClick={applyDefaultSuggestion}
                >
                  Bruk forslag
                </button>
                <button
                  type="button"
                  className="ds-btn ds-btn--ghost"
                  onClick={() => setShowManualEditing(true)}
                >
                  Velg annet
                </button>
              </div>
            </div>
          ) : null}

          {hasUpgradeContent && !showManualEditing ? (
            <div className="lp-editor-inspector__enterprise-applied">
              <span className="lp-editor-inspector__enterprise-applied-label">Valgt upgrade</span>
              <p className="lp-editor-inspector__enterprise-applied-value">
                {form.upgradeNote.trim() ||
                  (form.upgradeType ? ENTERPRISE_UPGRADE_LABELS[form.upgradeType] : "Upgrade valgt")}
              </p>
            </div>
          ) : null}

          <div className="lp-editor-inspector__enterprise-quick">
            <h5 className="lp-editor-inspector__enterprise-quick-title">Raskt premiumvalg</h5>
            <p className="lp-editor-inspector__enterprise-quick-lead">Ekstra verdi – samme Varmrett</p>
            <div className="lp-editor-inspector__enterprise-chips" role="group" aria-label="Raskt premiumvalg">
              {ENTERPRISE_UPGRADE_QUICK_CHOICES.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className={`lp-editor-inspector__enterprise-chip${
                    form.upgradeType === choice.upgradeType &&
                    form.upgradeNote.trim() === choice.upgradeNote
                      ? " is-active"
                      : ""
                  }`}
                  onClick={() => applyQuickChoice(choice)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="lp-editor-inspector__enterprise-manual-toggle"
            aria-expanded={showManualEditing}
            onClick={() => setShowManualEditing((v) => !v)}
          >
            {showManualEditing ? "Skjul manuell redigering" : "Rediger manuelt"}
          </button>

          {showManualEditing ? (
            <div className="lp-editor-inspector__enterprise-manual">
              <p className="lp-editor-inspector__enterprise-manual-lead">Avansert redigering</p>
              <div className="lp-editor-inspector__copy-actions">
                <button type="button" className="ds-btn ds-btn--ghost" onClick={onCopyFromLuxus}>
                  Bygg fra Luxus
                </button>
                <button type="button" className="ds-btn ds-btn--ghost" onClick={onCopyFromBasis}>
                  Bygg fra {TIER_SOURCE_LABELS.BASIS}
                </button>
              </div>

              <div className="lp-editor-inspector__enterprise-fields">
                <label className="lp-editor-inspector__field">
                  Basert på
                  <select
                    value={form.sourcePackage ?? ""}
                    onChange={(e) =>
                      onFormChange({
                        ...form,
                        sourcePackage: (e.target.value as PlanTier) || null,
                      })
                    }
                  >
                    <option value="">Ingen</option>
                    <option value="BASIS">Basis</option>
                    <option value="LUXUS">Luxus</option>
                  </select>
                </label>
                <label className="lp-editor-inspector__field">
                  Upgrade-type
                  <select
                    value={form.upgradeType ?? ""}
                    onChange={(e) =>
                      onFormChange({
                        ...form,
                        upgradeType: (e.target.value as EnterpriseUpgradeType) || null,
                      })
                    }
                  >
                    <option value="">Velg type</option>
                    {ENTERPRISE_UPGRADE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ENTERPRISE_UPGRADE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="lp-editor-inspector__field">
                  Hva får kunden ekstra?
                  <textarea
                    rows={3}
                    value={form.upgradeNote}
                    onChange={(e) => onFormChange({ ...form, upgradeNote: e.target.value })}
                    maxLength={500}
                    placeholder="Premium protein, større porsjon, dessert/frukt…"
                  />
                </label>
              </div>
            </div>
          ) : null}

          {enterpriseWarnings.map((w) => (
            <p
              key={w.code}
              className={w.blocking ? "lp-editor-inspector__error" : "lp-editor-inspector__warn"}
              role="status"
            >
              {w.message}
            </p>
          ))}
        </section>
      ) : null}

      {enterpriseWarnings.some((w) => !w.blocking) ? (
        <label className="lp-editor-inspector__confirm">
          <input
            type="checkbox"
            checked={confirmWarnings}
            onChange={(e) => onConfirmWarningsChange(e.target.checked)}
          />
          Jeg bekrefter publisering til tross for advarsel.
        </label>
      ) : null}

      <footer className="lp-editor-inspector__actions">
        <button type="button" className="ds-btn" disabled={pending || varmrettSaveBlocked} onClick={onSaveDraft}>
          {pending ? "Lagrer…" : "Lagre utkast"}
        </button>
        <button
          type="button"
          className="ds-btn ds-btn--primary"
          disabled={pending || varmrettSaveBlocked}
          onClick={onPublish}
        >
          {pending ? "Publiserer…" : "Publiser dag"}
        </button>
      </footer>
    </aside>
  );
}

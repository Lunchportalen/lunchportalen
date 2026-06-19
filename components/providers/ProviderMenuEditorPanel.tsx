"use client";

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
import type { EditorContext } from "@/lib/provider-menu/providerMenuWorkspace";
import { editorContextLine } from "@/lib/provider-menu/providerMenuWorkspace";
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
};

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
}: Props) {
  if (!open || !form || !context) {
    return (
      <aside className="provider-menu-inspector menu-inspector" aria-label="Inspector" data-state="closed">
        <div className="menu-inspector__empty">
          <p className="menu-inspector__empty-title">Velg en dag</p>
          <p className="menu-inspector__empty-lead">
            Klikk på varmmatrett, faste valg eller Enterprise-upgrade for å redigere.
          </p>
          <ol className="menu-inspector__steps">
            <li>Velg pakke (Basis, Luxus eller Enterprise)</li>
            <li>Åpne en dag i ukeplanen</li>
            <li>Rediger og publiser i panelet her</li>
          </ol>
        </div>
      </aside>
    );
  }

  const isVarmrettMode = isSanityDrivenCategory(form.category);
  const isCatalogMode = !isVarmrettMode && (context.mode === "catalog" || categoryOnly);
  const isEnterpriseMode = tier === "ENTERPRISE" && isVarmrettMode;

  const slotStatus =
    form.status === "published" ? "Publisert" : form.status === "draft" ? "Utkast" : "Ikke publisert";

  const enterpriseDelta = ENTERPRISE_PRICE_EX_VAT - LUXUS_PRICE_EX_VAT;
  const luxusMargin =
    margin?.estimatedCostNok != null
      ? Math.round((LUXUS_PRICE_EX_VAT - margin.estimatedCostNok) * 100) / 100
      : null;
  const extraMargin =
    margin?.grossMarginNok != null && luxusMargin != null
      ? Math.round((margin.grossMarginNok - luxusMargin) * 100) / 100
      : null;

  return (
    <aside className="provider-menu-inspector menu-inspector is-open" aria-label="Inspector">
      <header className="menu-inspector__head">
        <div>
          <p className="menu-inspector__mode">
            {isCatalogMode && categoryOnly
              ? "Faste valg"
              : isVarmrettMode
                ? "Dagens varmmatrett"
                : "Enterprise upgrade"}
          </p>
          <h3 className="menu-inspector__context">{editorContextLine(context)}</h3>
        </div>
        <button type="button" className="ds-btn ds-btn--ghost menu-inspector__close" onClick={onClose}>
          Lukk
        </button>
      </header>

      <section className="menu-inspector__section menu-inspector__section--status">
        <h4 className="menu-inspector__section-title">Status</h4>
        <p className="menu-inspector__status-value">{slotStatus}</p>
      </section>

      {isCatalogMode && categoryOnly && categoryVariantLabels && categoryVariantLabels.length > 0 ? (
        <section className="menu-inspector__section">
          <h4 className="menu-inspector__section-title">Katalogstyrte valg</h4>
          <p className="menu-inspector__note">Dette er katalogstyrte valg. Publiser kategorien for denne dagen.</p>
          <ul className="menu-inspector__variant-list">
            {categoryVariantLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
          {catalogVariantAllergens && catalogVariantAllergens.length > 0 ? (
            <p className="menu-inspector__meta">Allergener: {catalogVariantAllergens.join(", ")}</p>
          ) : null}
        </section>
      ) : null}

      {isVarmrettMode ? (
        <>
          <section className="menu-inspector__section">
            <h4 className="menu-inspector__section-title">Rett</h4>
            <label className="menu-inspector__field">
              Rettens navn
              <input
                value={form.mealTitle}
                onChange={(e) => onFormChange({ ...form, mealTitle: e.target.value })}
                maxLength={120}
              />
            </label>
            <label className="menu-inspector__field">
              Beskrivelse
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                maxLength={4000}
              />
            </label>
          </section>
          <section className="menu-inspector__section">
            <h4 className="menu-inspector__section-title">Allergener & kost</h4>
            <label className="menu-inspector__field">
              Allergener
              <input
                value={form.allergensText}
                onChange={(e) => onFormChange({ ...form, allergensText: e.target.value })}
                placeholder="F.eks. melk, hvete"
              />
            </label>
            <label className="menu-inspector__field">
              Estimert råvarekost (kr)
              <input
                type="number"
                min={0}
                max={200}
                step={0.5}
                value={form.estimatedCostPerPortion ?? ""}
                onChange={(e) =>
                  onFormChange({
                    ...form,
                    estimatedCostPerPortion: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          </section>
        </>
      ) : null}

      {isCatalogMode && !categoryOnly && context.variantLabel ? (
        <section className="menu-inspector__section">
          <h4 className="menu-inspector__section-title">Fast valg</h4>
          <p className="menu-inspector__readonly-value">{context.variantLabel}</p>
          <p className="menu-inspector__note">Katalogstyrt — publiser kategorien for å aktivere.</p>
        </section>
      ) : null}

      {!isVarmrettMode && !isCatalogMode ? (
        <section className="menu-inspector__section">
          <h4 className="menu-inspector__section-title">Innhold</h4>
          <label className="menu-inspector__field">
            Rettens navn
            <input
              value={form.mealTitle}
              onChange={(e) => onFormChange({ ...form, mealTitle: e.target.value })}
              maxLength={120}
            />
          </label>
          <label className="menu-inspector__field">
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

      <p className="menu-inspector__media-hint">Bilde er valgfritt og brukes kun der det gir verdi.</p>
      {imageUrl ? <img src={imageUrl} alt="" className="menu-inspector__thumb" /> : null}

      {margin ? (
        <section className="menu-inspector__section menu-inspector__section--margin">
          <h4 className="menu-inspector__section-title">Pris & margin</h4>
          <p>
            Pris eks. mva: <strong>{formatPriceExVatLabel(margin.priceExVatNok)}</strong>
          </p>
          {margin.estimatedCostNok != null ? (
            <>
              <p>
                Estimert kost: <strong>{margin.estimatedCostNok.toLocaleString("nb-NO")} kr</strong>
              </p>
              <p>
                Dekningsbidrag: <strong>{margin.grossMarginNok?.toLocaleString("nb-NO") ?? "—"} kr</strong>
                {margin.marginPercent != null ? ` (${margin.marginPercent} %)` : ""}
              </p>
            </>
          ) : (
            <p className="menu-inspector__note">Legg inn råvarekost for marginberegning.</p>
          )}
        </section>
      ) : null}

      {isEnterpriseMode ? (
        <section className="menu-inspector__section menu-inspector__section--enterprise enterprise-premium">
          <h4 className="menu-inspector__section-title">Enterprise-verdi</h4>
          <p className="menu-inspector__enterprise-lead">
            Kunden betaler <strong>+{enterpriseDelta} kr</strong> mer enn Luxus. Beskriv hva kunden får ekstra.
          </p>

          <div className="menu-inspector__enterprise-kpis">
            <div className="menu-inspector__kpi">
              <span className="menu-inspector__kpi-label">Merpris</span>
              <span className="menu-inspector__kpi-value">+{enterpriseDelta} kr</span>
            </div>
            {margin?.estimatedCostNok != null ? (
              <div className="menu-inspector__kpi">
                <span className="menu-inspector__kpi-label">Est. råvarekost</span>
                <span className="menu-inspector__kpi-value">{margin.estimatedCostNok} kr</span>
              </div>
            ) : null}
            {extraMargin != null ? (
              <div className="menu-inspector__kpi">
                <span className="menu-inspector__kpi-label">Ekstra dekningsbidrag</span>
                <span className="menu-inspector__kpi-value">{extraMargin} kr</span>
              </div>
            ) : null}
          </div>

          <div className="menu-inspector__copy-actions">
            <button type="button" className="ds-btn ds-btn--ghost" onClick={onCopyFromLuxus}>
              Bygg fra Luxus
            </button>
            <button type="button" className="ds-btn ds-btn--ghost" onClick={onCopyFromBasis}>
              Bygg fra Basis
            </button>
          </div>

          <label className="menu-inspector__field">
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
          <label className="menu-inspector__field">
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
          <label className="menu-inspector__field">
            Hva får kunden ekstra?
            <textarea
              rows={3}
              value={form.upgradeNote}
              onChange={(e) => onFormChange({ ...form, upgradeNote: e.target.value })}
              maxLength={500}
              placeholder="Premium protein, større porsjon, dessert/frukt, ekstra tilbehør…"
            />
          </label>
          {enterpriseWarnings.map((w) => (
            <p
              key={w.code}
              className={w.blocking ? "menu-inspector__error" : "menu-inspector__warn"}
              role="status"
            >
              {w.message}
            </p>
          ))}
        </section>
      ) : null}

      {enterpriseWarnings.some((w) => !w.blocking) ? (
        <label className="menu-inspector__confirm">
          <input
            type="checkbox"
            checked={confirmWarnings}
            onChange={(e) => onConfirmWarningsChange(e.target.checked)}
          />
          Jeg bekrefter publisering til tross for advarsel.
        </label>
      ) : null}

      <footer className="menu-inspector__actions">
        <button type="button" className="ds-btn" disabled={pending} onClick={onSaveDraft}>
          {pending ? "Lagrer…" : "Lagre utkast"}
        </button>
        <button type="button" className="ds-btn ds-btn--primary" disabled={pending} onClick={onPublish}>
          {pending ? "Publiserer…" : "Publiser"}
        </button>
      </footer>
    </aside>
  );
}

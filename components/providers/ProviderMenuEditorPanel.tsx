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

type Props = {
  open: boolean;
  context: EditorContext | null;
  form: ResolvedProviderMenuSlot | null;
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
};

export default function ProviderMenuEditorPanel({
  open,
  context,
  form,
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
}: Props) {
  if (!open || !form || !context) {
    return (
      <aside className="provider-menu-inspector ds-provider-menu-editor" aria-label="Inspector" data-state="closed">
        <div className="ds-provider-menu-editor__empty">
          <p className="ds-h4">Velg en dag og kategori</p>
          <p className="ds-body">
            Klikk en variant eller varmmatrett for å redigere innhold, allergener og publisering.
          </p>
        </div>
      </aside>
    );
  }

  const isCatalogMode = context.mode === "catalog";
  const isVarmrettMode = context.mode === "varmrett";
  const isEnterpriseMode = context.mode === "enterprise";

  return (
    <aside className="provider-menu-inspector ds-provider-menu-editor is-open" aria-label="Inspector">
      <header className="ds-provider-menu-editor__head">
        <div>
          <p className="ds-provider-menu-editor__mode">
            {isCatalogMode ? "Katalogvalg" : isVarmrettMode ? "Dagens varmmatrett" : "Enterprise upgrade"}
          </p>
          <h3 className="ds-h4">{editorContextLine(context)}</h3>
        </div>
        <button type="button" className="ds-btn ds-btn--ghost ds-provider-menu-editor__close" onClick={onClose}>
          Lukk
        </button>
      </header>

      {isCatalogMode ? (
        <p className="ds-provider-menu-editor__note">
          Fast valg fra menykatalogen. Publiser kategorien for å aktivere levering denne dagen.
        </p>
      ) : null}

      {isVarmrettMode ? (
        <p className="ds-provider-menu-editor__note">Kilde: Sanity/bank — rullerende varmmat per dag.</p>
      ) : null}

      {catalogVariantAllergens && catalogVariantAllergens.length > 0 ? (
        <p className="ds-provider-menu-editor__allergens">
          Allergener (katalog): {catalogVariantAllergens.join(", ")}
        </p>
      ) : null}

      {imageUrl ? (
        <img src={imageUrl} alt="" className="ds-provider-menu-editor__thumb" />
      ) : (
        <p className="ds-provider-menu-editor__media-hint">Bilde er valgfritt og brukes kun der det gir verdi.</p>
      )}

      {!isCatalogMode ? (
        <label className="ds-provider-menu-builder__field">
          Rettens navn
          <input
            value={form.mealTitle}
            onChange={(e) => onFormChange({ ...form, mealTitle: e.target.value })}
            maxLength={120}
          />
        </label>
      ) : (
        <div className="ds-provider-menu-editor__readonly">
          <span className="ds-provider-menu-editor__readonly-label">Fast valg</span>
          <strong>{context.variantLabel ?? form.mealTitle}</strong>
        </div>
      )}

      <label className="ds-provider-menu-builder__field">
        Beskrivelse
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => onFormChange({ ...form, description: e.target.value })}
          maxLength={4000}
          readOnly={isCatalogMode}
        />
      </label>

      <label className="ds-provider-menu-builder__field">
        Allergener (kommaseparert)
        <input
          value={form.allergensText}
          onChange={(e) => onFormChange({ ...form, allergensText: e.target.value })}
          placeholder="F.eks. melk, hvete"
          readOnly={isCatalogMode && !isSanityDrivenCategory(form.category)}
        />
      </label>

      {!isCatalogMode ? (
        <label className="ds-provider-menu-builder__field">
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
      ) : null}

      {margin ? (
        <div className="ds-provider-menu-builder__margin">
          <p>
            Pris eks. mva: <strong>{formatPriceExVatLabel(margin.priceExVatNok)}</strong>
          </p>
          {margin.estimatedCostNok != null ? (
            <>
              <p>
                Estimert kost: <strong>{margin.estimatedCostNok.toLocaleString("nb-NO")} kr</strong>
              </p>
              <p>
                Estimert bruttofortjeneste:{" "}
                <strong>{margin.grossMarginNok?.toLocaleString("nb-NO") ?? "—"} kr</strong>
                {margin.marginPercent != null ? ` (${margin.marginPercent} %)` : ""}
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      {isEnterpriseMode ? (
        <fieldset className="ds-provider-menu-builder__enterprise ds-provider-menu-editor__enterprise-premium">
          <legend>Enterprise-verdi</legend>
          <p className="ds-provider-menu-editor__enterprise-lead">
            Hva får kunden ekstra for Enterprise?
          </p>

          {(form.sourcePackage || form.upgradeType || form.upgradeNote) && (
            <div className="ds-provider-menu-editor__enterprise-summary">
              {form.sourcePackage ? (
                <p>
                  <span className="ds-provider-menu-editor__summary-label">Basert på</span>{" "}
                  {TIER_SOURCE_LABELS[form.sourcePackage]}
                </p>
              ) : null}
              {form.upgradeType ? (
                <p>
                  <span className="ds-provider-menu-editor__summary-label">Upgrade</span>{" "}
                  {ENTERPRISE_UPGRADE_LABELS[form.upgradeType]}
                </p>
              ) : null}
              {form.upgradeNote ? (
                <p>
                  <span className="ds-provider-menu-editor__summary-label">Kundeverdi</span> {form.upgradeNote}
                </p>
              ) : null}
              {margin?.grossMarginNok != null ? (
                <p>
                  <span className="ds-provider-menu-editor__summary-label">Margin</span>{" "}
                  {margin.grossMarginNok.toLocaleString("nb-NO")} kr
                  {margin.marginPercent != null ? ` (${margin.marginPercent} %)` : ""}
                </p>
              ) : null}
            </div>
          )}

          <div className="ds-provider-menu-builder__copy-actions">
            <button type="button" className="ds-btn ds-btn--ghost" onClick={onCopyFromBasis}>
              Bygg fra Basis
            </button>
            <button type="button" className="ds-btn ds-btn--ghost" onClick={onCopyFromLuxus}>
              Bygg fra Luxus
            </button>
          </div>
          <label className="ds-provider-menu-builder__field">
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
          <label className="ds-provider-menu-builder__field">
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
          <label className="ds-provider-menu-builder__field">
            Upgrade-beskrivelse
            <textarea
              rows={3}
              value={form.upgradeNote}
              onChange={(e) => onFormChange({ ...form, upgradeNote: e.target.value })}
              maxLength={500}
              placeholder="F.eks. ekstra laks, premium topping, ponzu, frukt ved siden av"
            />
          </label>
          {enterpriseWarnings.map((w) => (
            <p
              key={w.code}
              className={w.blocking ? "ds-provider-menu-builder__error" : "ds-provider-menu-builder__warn"}
              role="status"
            >
              {w.message}
            </p>
          ))}
        </fieldset>
      ) : null}

      {enterpriseWarnings.some((w) => !w.blocking) ? (
        <label className="ds-provider-menu-builder__confirm">
          <input
            type="checkbox"
            checked={confirmWarnings}
            onChange={(e) => onConfirmWarningsChange(e.target.checked)}
          />
          Jeg bekrefter publisering til tross for advarsel.
        </label>
      ) : null}

      <div className="ds-provider-meny-actions ds-provider-menu-editor__actions">
        <button type="button" className="ds-btn" disabled={pending} onClick={onSaveDraft}>
          {pending ? "Lagrer…" : "Lagre utkast"}
        </button>
        <button type="button" className="ds-btn ds-btn--primary" disabled={pending} onClick={onPublish}>
          {pending ? "Publiserer…" : "Publiser"}
        </button>
      </div>
    </aside>
  );
}

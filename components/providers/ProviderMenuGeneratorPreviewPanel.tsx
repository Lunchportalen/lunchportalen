"use client";

import type { ProviderMenuGeneratorPreviewPresentation } from "@/lib/provider-menu/providerMenuGeneratorPresentation";

import ProviderMenuGeneratorApplyFlow from "@/components/providers/ProviderMenuGeneratorApplyFlow";

type Props = {
  presentation: ProviderMenuGeneratorPreviewPresentation;
  canApply?: boolean;
};

export default function ProviderMenuGeneratorPreviewPanel({ presentation, canApply = false }: Props) {
  if (!presentation.active) return null;

  const { employeeSafePreview, providerPreview, fixedDishBankStatus } = presentation;
  const firstDay = employeeSafePreview.days[0];

  return (
    <section className="ds-card ds-section" data-testid="provider-menu-generator-preview">
      <h2 className="ds-h3">Lokal fast menygenerator</h2>
      <p className="ds-body ds-muted">
        Provider-styrt menyprofil · {presentation.menuLocale} · {presentation.country} ·{" "}
        {presentation.menuProfileId}
      </p>

      {presentation.fallbackWarning ? (
        <p className="ds-body" role="status">
          {presentation.fallbackWarning}
        </p>
      ) : null}

      <dl className="ds-kv-grid">
        <div>
          <dt>Valuta</dt>
          <dd>{presentation.currency}</dd>
        </div>
        <div>
          <dt>MVA</dt>
          <dd>{(presentation.vatRate * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt>Rettbank</dt>
          <dd>
            {fixedDishBankStatus.totalDishes} retter (
            {fixedDishBankStatus.meetsMinimums ? "OK" : "under minimum"})
          </dd>
        </div>
        <div>
          <dt>Uke (forhåndsvisning)</dt>
          <dd>{presentation.weekStart}</dd>
        </div>
      </dl>

      <details className="ds-details">
        <summary>Økonomi (kun provider)</summary>
        <p className="ds-body ds-muted">
          Valuta {providerPreview.profile.economySummary.currency} · margin{" "}
          {(providerPreview.profile.economySummary.marginTarget * 100).toFixed(0)}%
        </p>
      </details>

      <h3 className="ds-h4">Employee-safe forhåndsvisning</h3>
      {firstDay ? (
        <ul className="ds-list">
          {firstDay.choices.map((choice) => (
            <li key={choice.choiceKey}>
              <strong>{choice.title}</strong> · {choice.categoryKey}
              {choice.allergens.length ? (
                <span className="ds-muted"> · {choice.allergens.join(", ")}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ds-body">Ingen valg for valgt uke.</p>
      )}

      <ProviderMenuGeneratorApplyFlow presentation={presentation} canApply={canApply} />
    </section>
  );
}

import type { DashboardData } from "@/app/leverandor/innstillinger/tripletex/status/actions";

type Props = {
  counts: DashboardData["resourceCounts"];
};

export default function ResourceSummary({ counts }: Props) {
  return (
    <section className="ds-section" aria-labelledby="tpt-resource-summary-title">
      <h2 id="tpt-resource-summary-title" className="ds-h3">
        Ressurser i Tripletex
      </h2>
      <div className="ds-cards-3 ds-tripletex-status__cards">
        <article className="ds-card ds-tripletex-status__resource-card">
          <p className="ds-body-sm">Produkter</p>
          <p className="ds-h3 ds-tripletex-status__resource-value">{counts.products}</p>
        </article>
        <article className="ds-card ds-tripletex-status__resource-card">
          <p className="ds-body-sm">Kunder</p>
          <p className="ds-h3 ds-tripletex-status__resource-value">{counts.customers}</p>
        </article>
        <article className="ds-card ds-tripletex-status__resource-card">
          <p className="ds-body-sm">MVA-koder</p>
          <p className="ds-h3 ds-tripletex-status__resource-value">{counts.vatCodes}</p>
        </article>
      </div>
    </section>
  );
}

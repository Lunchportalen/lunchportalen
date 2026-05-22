import type { DashboardData } from "@/app/leverandor/innstillinger/tripletex/status/actions";

type Props = {
  counts: DashboardData["resourceCounts"];
};

const CARDS = [
  { key: "products" as const, label: "Produkter", meta: "Mappede måltidsprodukter" },
  { key: "customers" as const, label: "Kunder", meta: "Firma-koblinger i Tripletex" },
  { key: "vatCodes" as const, label: "MVA-koder", meta: "Unike avgiftskoder i bruk" },
];

export default function ResourceSummary({ counts }: Props) {
  return (
    <div className="ds-cards-3 ds-tripletex-status__resource-grid">
      {CARDS.map((card) => (
        <article key={card.key} className="ds-card ds-tripletex-status__resource-card">
          <p className="ds-eyebrow">{card.label}</p>
          <p className="ds-tripletex-status__stat-number">{counts[card.key]}</p>
          <p className="ds-body-sm ds-tripletex-status__text-soft">{card.meta}</p>
        </article>
      ))}
    </div>
  );
}

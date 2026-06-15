import type { ReadinessStripItem } from "@/lib/admin/dashboardOnboarding";

function kindClass(kind: ReadinessStripItem["kind"]) {
  if (kind === "ready") return "ds-admin-readiness__card is-ready";
  if (kind === "action") return "ds-admin-readiness__card is-action";
  if (kind === "pending") return "ds-admin-readiness__card is-pending";
  return "ds-admin-readiness__card is-neutral";
}

export default function ReadinessStrip({ items }: { items: ReadinessStripItem[] }) {
  return (
    <section className="ds-admin-readiness" aria-label="Operativ beredskap">
      <div className="ds-admin-readiness__head">
        <h2 className="ds-admin-readiness__title">Operativ beredskap</h2>
        <p className="ds-admin-readiness__sub">Status for avtale, leverandør og første bestilling</p>
      </div>
      <div className="ds-admin-readiness__grid">
        {items.map((item) => (
          <div key={item.label} className={kindClass(item.kind)}>
            <div className="ds-admin-readiness__label">{item.label}</div>
            <div className="ds-admin-readiness__value">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

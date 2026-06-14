import Link from "next/link";

export type AdminKpi = {
  label: string;
  value: string;
  foot: string;
  href?: string;
  ctaLabel?: string;
  trend?: {
    label: string;
    kind?: "positive" | "neutral";
  } | null;
};

function KpiCard({ item }: { item: AdminKpi }) {
  const body = (
    <>
      <div className="ds-admin-kpi__top">
        {item.trend ? (
          <span className={`ds-admin-kpi__trend${item.trend.kind === "neutral" ? " is-neutral" : ""}`}>
            {item.trend.label}
          </span>
        ) : null}
      </div>
      <div className="ds-admin-kpi__label">{item.label}</div>
      <div className="ds-admin-kpi__value">{item.value}</div>
      <div className="ds-admin-kpi__foot">{item.foot}</div>
      {item.href && item.ctaLabel ? (
        <span className="ds-admin-kpi__cta">{item.ctaLabel} →</span>
      ) : null}
    </>
  );

  if (item.href) {
    return (
      <Link href={item.href} className="ds-admin-kpi ds-admin-kpi--link">
        {body}
      </Link>
    );
  }

  return <div className="ds-admin-kpi">{body}</div>;
}

export default function KpiRow({ data }: { data: AdminKpi[] }) {
  return (
    <section className="ds-admin-kpi-row" aria-label="Nøkkeltall">
      {data.map((item) => (
        <KpiCard key={item.label} item={item} />
      ))}
    </section>
  );
}

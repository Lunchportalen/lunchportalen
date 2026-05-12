export type AdminKpi = {
  label: string;
  value: string;
  foot: string;
  trend?: {
    label: string;
    kind?: "positive" | "neutral";
  } | null;
};

export default function KpiRow({ data }: { data: AdminKpi[] }) {
  return (
    <section className="ds-admin-kpi-row" aria-label="Nøkkeltall">
      {data.map((item) => (
        <div className="ds-admin-kpi" key={item.label}>
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
        </div>
      ))}
    </section>
  );
}

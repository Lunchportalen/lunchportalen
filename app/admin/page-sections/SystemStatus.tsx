export type SystemStatusRow = {
  label: string;
  value: string;
  kind?: "ok" | "warn" | "danger";
};

export default function SystemStatus({ data }: { data: SystemStatusRow[] }) {
  return (
    <section className="ds-admin-card">
      <div className="ds-admin-card__head">
        <div>
          <h2 className="ds-admin-card__title">Systemstatus</h2>
          <p className="ds-admin-card__sub">Fasit akkurat nå</p>
        </div>
      </div>
      <div className="ds-admin-status">
        {data.map((row) => (
          <div className="ds-admin-status__row" key={row.label}>
            <div className="ds-admin-status__label">{row.label}</div>
            <div className="ds-admin-status__value">
              <span
                className={`ds-admin-status__pill${
                  row.kind === "danger" ? " is-danger" : row.kind === "warn" ? " is-warn" : ""
                }`}
                aria-hidden="true"
              />
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

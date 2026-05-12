export type OrdersChartPoint = {
  label: string;
  value: number;
};

function clampPoint(value: number, max: number) {
  if (max <= 0) return 190;
  return 190 - (Math.max(0, value) / max) * 140;
}

export default function OrdersChart({ data }: { data: OrdersChartPoint[] }) {
  const points = data.length ? data : [];
  const max = Math.max(1, ...points.map((point) => point.value));
  const xStep = points.length > 1 ? 520 / (points.length - 1) : 0;
  const coords = points.map((point, index) => ({
    ...point,
    x: 40 + index * xStep,
    y: clampPoint(point.value, max),
  }));
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = coords.length ? `40,190 ${line} ${coords[coords.length - 1].x},190` : "";
  const last = coords[coords.length - 1] ?? { x: 560, y: 190, value: 0 };

  return (
    <section className="ds-admin-card">
      <div className="ds-admin-card__head">
        <div>
          <h2 className="ds-admin-card__title">Bestillinger denne uken</h2>
          <p className="ds-admin-card__sub">Daglige bestillinger pr. ukedag</p>
        </div>
        <div className="ds-admin-filter" aria-label="Periodefilter">
          <button className="ds-admin-filter__btn" type="button" aria-disabled="true">
            7d
          </button>
          <button className="ds-admin-filter__btn is-active" type="button" aria-disabled="true">
            14d
          </button>
          <button className="ds-admin-filter__btn" type="button" aria-disabled="true">
            30d
          </button>
        </div>
      </div>
      <div className="ds-admin-chart">
        <svg viewBox="0 0 600 220" preserveAspectRatio="none" aria-label="Graf over ukens bestillinger" role="img">
          <defs>
            <linearGradient id="adminOrdersFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--ds-accent)" stopOpacity=".22" />
              <stop offset="100%" stopColor="var(--ds-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M40 50H560M40 120H560M40 190H560" stroke="rgba(17,17,17,.05)" strokeWidth="1" />
          {area ? <polygon points={area} fill="url(#adminOrdersFill)" /> : null}
          {line ? <polyline points={line} fill="none" stroke="var(--ds-accent)" strokeWidth="2.8" /> : null}
          <circle cx={last.x} cy={last.y} r="11" fill="var(--ds-accent)" opacity=".18" />
          <circle cx={last.x} cy={last.y} r="6" fill="#fff" stroke="var(--ds-accent)" strokeWidth="2.4" />
          <rect x="492" y="18" width="76" height="24" rx="12" fill="var(--ds-text)" />
          <text x="530" y="34" textAnchor="middle" fill="var(--ds-accent)" fontSize="10" fontWeight="800">
            {last.value} I DAG
          </text>
          {coords.map((point) => (
            <text
              key={point.label}
              x={point.x}
              y="214"
              textAnchor="middle"
              fill="rgba(17,17,17,.55)"
              fontSize="10"
              fontWeight="700"
              letterSpacing=".06em"
            >
              {point.label}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}

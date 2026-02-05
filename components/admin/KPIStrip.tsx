type KPIItem = {
  label: string;
  value: string;
  note?: string;
};

type Props = {
  title: string;
  items: KPIItem[];
  emptyTitle: string;
  emptyBody: string;
  showEmptyPanel?: boolean;
};

export default function KPIStrip({ title, items, emptyTitle, emptyBody, showEmptyPanel = true }: Props) {
  const showEmpty = items.length === 0;

  return (
    <section className="mt-5 rounded-2xl bg-white/70 p-5 ring-1 ring-[rgb(var(--lp-border))] backdrop-blur">
      <div className="text-xs font-extrabold tracking-wide text-neutral-600">{title}</div>

      {showEmpty && showEmptyPanel ? (
        <div className="mt-3 rounded-xl border border-[rgb(var(--lp-border))] bg-white/80 p-4 text-sm text-neutral-700">
          <div className="font-semibold text-neutral-900">{emptyTitle}</div>
          <div className="mt-1">{emptyBody}</div>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {items.slice(0, 3).map((item) => (
            <div key={item.label} className="rounded-xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
              <div className="text-xs font-extrabold tracking-wide text-neutral-600">{item.label}</div>
              <div className="mt-2 text-3xl font-black text-neutral-950">{item.value}</div>
              {item.note ? <div className="mt-1 text-xs text-neutral-600">{item.note}</div> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

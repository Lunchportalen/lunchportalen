import { Card } from "@/components/ui/card";

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
    <section className="lp-glass-card mt-5 rounded-card p-5">
      <div className="text-xs font-extrabold tracking-wide text-neutral-600">{title}</div>

      {showEmpty && showEmptyPanel ? (
        <div className="lp-empty-soft mt-3 rounded-xl p-4 text-sm text-neutral-700">
          <div className="font-semibold text-neutral-900">{emptyTitle}</div>
          <div className="mt-1">{emptyBody}</div>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {items.slice(0, 3).map((item) => (
            <Card key={item.label} variant="soft" className="p-4">
              <div className="text-xs font-extrabold tracking-wide text-neutral-600">{item.label}</div>
              <div className="mt-2 text-3xl font-black text-neutral-950">{item.value}</div>
              {item.note ? <div className="mt-1 text-xs text-neutral-600">{item.note}</div> : null}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

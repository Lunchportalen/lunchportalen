// app/admin/dashboard/Sparkline.tsx
export default function Sparkline({
  values,
  height = 44,
}: {
  values: number[];
  height?: number;
}) {
  const w = 160;
  const h = height;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;

  const pts = values
    .map((v, i) => {
      const x = i * step;
      const y = h - (v / max) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.9" />
    </svg>
  );
}

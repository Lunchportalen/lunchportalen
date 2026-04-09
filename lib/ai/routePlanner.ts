/**
 * Leveringsrekkefølge V1: sortering etter tidsvindu, deretter stabil navnesortering.
 * Uten GPS — deterministisk og trygg.
 */

export type RouteStopInput = {
  id: string;
  name: string;
  /** "HH:MM" */
  windowStart: string;
  windowEnd: string;
};

export type RoutePlanOutput = {
  ordered: RouteStopInput[];
  transparency: string[];
};

function parseHHMM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return 9 * 60;
  const h = Math.min(23, Math.max(0, parseInt(m[1]!, 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2]!, 10)));
  return h * 60 + min;
}

export function planRouteOrder(stops: RouteStopInput[]): RoutePlanOutput {
  const transparency = [
    "Rute rekkefølges etter tidligste leveringsvindu, deretter lokasjonsnavn (ingen auto-GPS i V1).",
    "Sjåfør kan overstyre — dette er kun forslag.",
  ];

  const ordered = [...stops].sort((a, b) => {
    const t = parseHHMM(a.windowStart) - parseHHMM(b.windowStart);
    if (t !== 0) return t;
    return a.name.localeCompare(b.name, "nb");
  });

  return { ordered, transparency };
}

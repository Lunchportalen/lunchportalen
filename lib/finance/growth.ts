import { num } from "@/lib/finance/numbers";

/**
 * Vekstrate som (sum andre halvdel − sum første halvdel) / sum første halvdel på ordre sortert på `created_at`.
 * Deterministisk og forklarbar; krever minst 2 ordre.
 */
export function computeGrowth(orders: Array<{ line_total?: unknown; total_amount?: unknown; created_at?: string }>): number {
  const list = Array.isArray(orders) ? [...orders] : [];
  if (list.length < 2) return 0;

  list.sort((a, b) => {
    const ta = new Date(String(a.created_at ?? 0)).getTime();
    const tb = new Date(String(b.created_at ?? 0)).getTime();
    return ta - tb;
  });

  const mid = Math.floor(list.length / 2);
  const first = list.slice(0, mid);
  const second = list.slice(mid);

  const sum = (chunk: typeof list) => chunk.reduce((s, o) => s + num(o.line_total ?? o.total_amount), 0);
  const a = sum(first);
  const b = sum(second);
  if (a <= 0) return 0;
  return (b - a) / a;
}

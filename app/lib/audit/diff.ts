// lib/audit/diff.ts
import "server-only";

export function shallowDiff<T extends Record<string, any>>(before: T, after: T) {
  const out: Record<string, { from: any; to: any }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      out[k] = { from: before[k], to: after[k] };
    }
  }
  return out;
}

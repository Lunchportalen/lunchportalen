/**
 * Generic debounce for editor / client use (no React dependency).
 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, delayMs: number): (...args: A) => void {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (t !== null) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, delayMs);
  };
}

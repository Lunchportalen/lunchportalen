/**
 * Edge/global trygg wrapper (ingen server-only).
 */
export async function runGlobal<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.error("[GLOBAL_FAIL]", e);
    return null;
  }
}

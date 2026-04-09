/**
 * Edge-kompatibel wrapper — fanger feil uten å kaste.
 */
export async function runAtEdge<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.error("[EDGE_FAIL]", e);
    return null;
  }
}

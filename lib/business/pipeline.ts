import "server-only";

/**
 * Deterministic customer pipeline step (no DB).
 */
export function processCustomer(input: unknown): { status: "active"; value: number } {
  const o = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const valueRaw = o.value;
  const value =
    typeof valueRaw === "number" && Number.isFinite(valueRaw)
      ? valueRaw
      : typeof valueRaw === "string" && valueRaw.trim() !== ""
        ? Number(valueRaw)
        : 0;
  const safe = Number.isFinite(value) ? value : 0;

  console.log("[CUSTOMER_FLOW]", { keys: Object.keys(o).slice(0, 24) });

  return {
    status: "active",
    value: safe,
  };
}

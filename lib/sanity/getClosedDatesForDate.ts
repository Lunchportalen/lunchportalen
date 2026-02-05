// lib/sanity/getClosedDatesForDate.ts
/**
 * Backwards-compatible Sanity helper.
 * MUST exist, MUST be importable, MUST never throw.
 * Failsafe: returns [] on any error or missing implementation.
 */
export async function getClosedDatesForDate(isoDate: string): Promise<string[]> {
  try {
    // If you already have a Sanity-based closed dates mechanism,
    // connect it here (keep it deterministic and non-throwing).
    // For Phase 1/2 health correctness, an empty array is valid.
    void isoDate;
    return [];
  } catch {
    return [];
  }
}

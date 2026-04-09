import "server-only";

import type { SequenceEventInput } from "@/lib/ml/sequence-dataset";

/**
 * Placeholder feed — wire to analytics / events store when available. Fail-closed empty.
 */
export async function getSequenceEventsForAutopilot(_rid: string): Promise<SequenceEventInput[]> {
  void _rid;
  return [];
}

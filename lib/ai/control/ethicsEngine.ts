import { normalizeControlType } from "@/lib/ai/control/normalizeControlType";

const BLOCKED = new Set([
  "MANIPULATE_USER",
  "FAKE_SOCIAL_PROOF",
  "DECEPTIVE_COPY",
  "HIDDEN_PRICING",
]);

export function validateEthics(action: unknown): boolean {
  const t = normalizeControlType(action);
  if (!t) return false;
  return !BLOCKED.has(t);
}

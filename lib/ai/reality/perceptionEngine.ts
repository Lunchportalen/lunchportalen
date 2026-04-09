/**
 * Perception / positioning model (0–1 normalized). No user-facing copy here — planning only.
 * Ethical constraint: signals clarify truth and reduce friction; never invent facts or fake proof.
 */

export type PerceptionState = {
  clarity: number;
  trust: number;
  differentiation: number;
  consistency: number;
  friction: number;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function pickNum(input: unknown, key: string): number {
  if (input == null || typeof input !== "object") return 0;
  const v = (input as Record<string, unknown>)[key];
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function buildPerceptionState(input: unknown): PerceptionState {
  if (input == null || typeof input !== "object") {
    return { clarity: 0, trust: 0, differentiation: 0, consistency: 0, friction: 0 };
  }
  return {
    clarity: clamp01(pickNum(input, "clarity")),
    trust: clamp01(pickNum(input, "trust")),
    differentiation: clamp01(pickNum(input, "differentiation")),
    consistency: clamp01(pickNum(input, "consistency")),
    friction: clamp01(pickNum(input, "friction")),
  };
}

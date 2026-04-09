/**
 * Deterministic bandit-style policy (additive scores). Tie-break: lexicographic action id.
 */

const policy = new Map<string, number>();

export function updatePolicy(action: string, reward: number): void {
  const a = String(action ?? "").trim();
  if (!a) return;
  const r = Number.isFinite(reward) ? reward : 0;
  policy.set(a, (policy.get(a) ?? 0) + r * 0.1);
}

export function chooseAction(actions: string[]): string | null {
  const list = [...new Set(actions.map((a) => String(a ?? "").trim()).filter(Boolean))];
  if (list.length === 0) return null;
  const sorted = [...list].sort((a, b) => {
    const pa = policy.get(a) ?? 0;
    const pb = policy.get(b) ?? 0;
    if (pb !== pa) return pb - pa;
    return a.localeCompare(b);
  });
  return sorted[0] ?? null;
}

export function clearRlPolicyForTests(): void {
  policy.clear();
}

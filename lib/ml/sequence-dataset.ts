export type SequenceEventInput = {
  userId: string;
  type: string;
  value?: number;
  timestamp: number;
};

export type SequenceStep = {
  action: string;
  value: number;
  timestamp: number;
};

export type UserSequenceBundle = { userId: string; steps: SequenceStep[] };

/**
 * Groups events per user, sorted by timestamp (deterministic).
 */
export function buildUserSequences(events: SequenceEventInput[]): UserSequenceBundle[] {
  const users: Record<string, SequenceStep[]> = {};

  for (const e of events) {
    const id = String(e.userId ?? "").trim();
    if (!id) continue;
    if (!users[id]) users[id] = [];
    users[id].push({
      action: e.type,
      value: e.value ?? 0,
      timestamp: e.timestamp,
    });
  }

  return Object.entries(users).map(([userId, steps]) => ({
    userId,
    steps: [...steps].sort((a, b) => a.timestamp - b.timestamp),
  }));
}

import "server-only";

const MAX = 500;

const GLOBAL_MEMORY: unknown[] = [];

export function addGlobalMemory(entry: unknown): void {
  GLOBAL_MEMORY.push(entry);
  if (GLOBAL_MEMORY.length > MAX) {
    GLOBAL_MEMORY.shift();
  }
  console.log("[DISTRIBUTED_LEARN]", { depth: GLOBAL_MEMORY.length });
}

export function getGlobalMemory(): unknown[] {
  return [...GLOBAL_MEMORY];
}

import "server-only";

export function getConfiguredLeader(): string {
  return String(process.env.LEADER_NODE ?? "").trim() || "node-1";
}

export function isLeader(node: string): boolean {
  return String(node ?? "").trim() === getConfiguredLeader();
}

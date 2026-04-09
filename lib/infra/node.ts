import "server-only";

export function getNodeId(): string {
  const id = String(process.env.NODE_ID ?? "").trim();
  return id.length > 0 ? id : "node-1";
}

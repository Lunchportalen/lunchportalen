// STATUS: KEEP

// lib/superadmin/paging.ts
export type CompaniesCursor = {
  created_at: string;
  id: string;
};

export function encodeCursor(c: CompaniesCursor) {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeCursor(v: string | null): CompaniesCursor | null {
  if (!v) return null;
  try {
    const json = Buffer.from(v, "base64url").toString("utf8");
    const obj = JSON.parse(json);
    if (typeof obj?.created_at === "string" && typeof obj?.id === "string") return obj;
    return null;
  } catch {
    return null;
  }
}

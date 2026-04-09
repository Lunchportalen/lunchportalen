/**
 * Målrolle for B2B-meldinger — deterministisk deteksjon, fallback «office».
 */

export type Role = "hr" | "manager" | "office" | "procurement";

const ROLES: readonly Role[] = ["hr", "manager", "office", "procurement"];

export function isRole(v: string): v is Role {
  return (ROLES as readonly string[]).includes(v);
}

export function detectRole(text: string): Role {
  const t = String(text ?? "").toLowerCase();

  if (t.includes("hr") || t.includes("people")) return "hr";
  if (t.includes("leder") || t.includes("manager")) return "manager";
  if (t.includes("kontor") || t.includes("office")) return "office";
  if (t.includes("innkjøp") || t.includes("procurement")) return "procurement";

  return "office";
}

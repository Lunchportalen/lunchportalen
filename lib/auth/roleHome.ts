function safeStr(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function roleHome(role: string): string {
  const r = safeStr(role);
  if (r === "superadmin" || r === "super_admin") return "/superadmin";
  if (r === "company_admin" || r === "companyadmin" || r === "admin") return "/admin";
  if (r === "kitchen" || r === "kjokken") return "/kitchen";
  if (r === "driver" || r === "sjafor") return "/driver";
  return "/week";
}


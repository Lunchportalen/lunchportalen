// lib/auth/redirect.ts
export type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

export function homeForRole(role: Role) {
  switch (role) {
    case "superadmin":
      return "/superadmin";
    case "company_admin":
      return "/admin";
    case "kitchen":
      return "/kitchen";
    case "driver":
      return "/driver";
    case "employee":
    default:
      return "/week";
  }
}

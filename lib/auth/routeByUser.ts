// lib/auth/routeByUser.ts
import { systemRoleByEmail } from "@/lib/system/emails";

export type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

export function destinationForUser(user: {
  email?: string | null;
  user_metadata?: any;
}): { role: Role; path: string } {
  const systemRole = systemRoleByEmail(user.email);
  if (systemRole === "superadmin") return { role: "superadmin", path: "/superadmin" };
  if (systemRole === "kitchen") return { role: "kitchen", path: "/kitchen" };
  if (systemRole === "driver") return { role: "driver", path: "/driver" };

  // 2) Kundekontoer: rolle fra metadata/profil (fallback)
  const roleRaw = String(user.user_metadata?.role ?? "employee").toLowerCase();
  const role: Role =
    roleRaw === "company_admin"
      ? "company_admin"
      : roleRaw === "superadmin"
      ? "superadmin"
      : roleRaw === "kitchen"
      ? "kitchen"
      : roleRaw === "driver"
      ? "driver"
      : "employee";

  // 3) Standard destinasjon per rolle
  if (role === "superadmin") return { role, path: "/superadmin" };
  if (role === "company_admin") return { role, path: "/admin" };
  if (role === "kitchen") return { role, path: "/kitchen" };
  if (role === "driver") return { role, path: "/driver" };
  return { role: "employee", path: "/week" };
}

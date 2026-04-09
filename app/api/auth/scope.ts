export {
  allowSuperadminOrCompanyAdmin,
  allowSuperadminOrDriver,
  allowSuperadminOrKitchen,
  effectiveCompanyId,
  getScope,
  mustCompanyId,
  requireCompanyAdmin,
  requireDriver,
  requireEmployee,
  requireKitchen,
  requireRole,
  requireSuperadmin,
  ScopeError,
} from "@/lib/auth/scope";

export type { Role, Scope } from "@/lib/auth/scope";

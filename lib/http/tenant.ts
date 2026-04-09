// STATUS: KEEP

import "server-only";
import type { Scope } from "./types";
import { HttpError } from "./errors";

export function requireCompany(scope: Scope) {
  if (!scope.companyId) throw new HttpError("FORBIDDEN", "Missing company scope", 403);
  return scope.companyId;
}

export function requireLocation(scope: Scope) {
  if (!scope.locationId) throw new HttpError("FORBIDDEN", "Missing location scope", 403);
  return scope.locationId;
}

import "server-only";
import { HttpError } from "./errors";

export function requireString(v: unknown, field: string, opts?: { min?: number; max?: number }) {
  if (typeof v !== "string") throw new HttpError("INVALID_INPUT", `Invalid ${field}`, 400, { field });
  const s = v.trim();
  if (opts?.min && s.length < opts.min) throw new HttpError("INVALID_INPUT", `Invalid ${field}`, 400, { field });
  if (opts?.max && s.length > opts.max) throw new HttpError("INVALID_INPUT", `Invalid ${field}`, 400, { field });
  return s;
}

export function requireOneOf<T extends string>(v: unknown, field: string, allowed: readonly T[]): T {
  if (typeof v !== "string") throw new HttpError("INVALID_INPUT", `Invalid ${field}`, 400, { field, allowed });
  if (!allowed.includes(v as T)) throw new HttpError("INVALID_INPUT", `Invalid ${field}`, 400, { field, allowed });
  return v as T;
}

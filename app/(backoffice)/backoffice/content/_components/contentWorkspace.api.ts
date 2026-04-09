/**
 * Locked API envelope helpers for backoffice content PATCH/GET JSON responses.
 * Single transport contract: `{ ok, rid, data }` / `{ ok: false, rid, ... }`.
 */

import { safeStr } from "./contentWorkspace.helpers";

export type ApiOk<T> = {
  ok: true;
  rid: string;
  data: T;
};

export type ApiErr = {
  ok: false;
  rid: string;
  error: string;
  message: string;
  status: number;
};

export type ApiResponse<T> = ApiOk<T> | ApiErr;

export function readApiMessage<T>(payload: ApiResponse<T> | null | undefined): string {
  if (payload && payload.ok === false) return safeStr(payload.message);
  return "";
}

export function readApiRid<T>(payload: ApiResponse<T> | null | undefined): string {
  if (!payload) return "";
  return safeStr((payload as { rid?: unknown }).rid);
}

export function readApiError<T>(
  status: number,
  payload: ApiResponse<T> | null | undefined,
  fallback: string
): string {
  const message = readApiMessage(payload);
  if (message) return message;

  const rid = readApiRid(payload);
  const withRid = (text: string) => (rid ? `${text} (rid: ${rid})` : text);

  if (status === 401) return withRid("Ikke innlogget.");
  if (status === 403) return withRid("Ingen tilgang.");
  if (status === 404) return withRid("Fant ikke side.");
  if (status === 409) return withRid("Slug er allerede i bruk.");
  return withRid(fallback);
}

export async function parseJsonSafe<T>(res: Response): Promise<ApiResponse<T> | null> {
  try {
    return (await res.json()) as ApiResponse<T>;
  } catch {
    return null;
  }
}

/** Trace API responses: jsonOk/jsonErr both include `rid`. */
export function logApiRidFromBody(data: unknown): void {
  if (!data || typeof data !== "object") return;
  const rid = (data as { rid?: unknown }).rid;
  if (typeof rid === "string" && rid.length > 0) {
    if (process.env.NODE_ENV !== "production") {
      const { log } = console;
      log("[RID]", rid);
    }
  }
}

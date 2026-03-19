/**
 * API response types and response-reading helpers for ContentWorkspace.
 * No React, no hooks.
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

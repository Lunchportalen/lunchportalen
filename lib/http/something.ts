// lib/http/something.ts
// Ren server-side businesslogikk.
// Ingen Next.js route config her (runtime/dynamic/revalidate hører hjemme i route.ts).

import "server-only";

export type SomethingInput = {
  userId: string;
  payload?: unknown;
};

export type SomethingSuccess = {
  ok: true;
  data: {
    processed: boolean;
    userId: string;
    timestamp: string;
    payload?: unknown;
  };
};

export type SomethingFailure = {
  ok: false;
  error: string;
  code?: string;
};

export type SomethingResult = SomethingSuccess | SomethingFailure;

/**
 * Trygg streng-konvertering
 */
function safeStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Hovedfunksjon som brukes av route.ts
 */
export async function handleSomething(
  input: SomethingInput
): Promise<SomethingResult> {
  try {
    if (!input.userId || input.userId.trim().length === 0) {
      return {
        ok: false,
        error: "Missing userId",
        code: "MISSING_USER_ID",
      };
    }

    // Her legger du faktisk logikk:
    // f.eks Supabase kall, Sanity fetch, agreement-check, etc.

    const now = new Date().toISOString();

    return {
      ok: true,
      data: {
        processed: true,
        userId: input.userId,
        timestamp: now,
        payload: input.payload,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: safeStr(err),
      code: "UNEXPECTED_ERROR",
    };
  }
}

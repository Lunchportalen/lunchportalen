import "server-only";

import type { NextRequest } from "next/server";
import type { z } from "zod";

import { jsonErr } from "@/lib/http/respond";

export type ValidationContext = {
  req: NextRequest;
  rid: string;
};

/**
 * Zod-validated JSON body for App Router handlers.
 * Returns locked API contract: jsonErr med rid, status, error, message, detail (RC/dev).
 */
export function withValidation<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  handler: (data: z.infer<TSchema>, ctx: ValidationContext) => Promise<Response> | Response
) {
  return async (req: NextRequest, rid: string): Promise<Response> => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr(rid, "Ugyldig JSON.", 400, "INVALID_JSON");
    }

    const result = schema.safeParse(body);
    if (!result.success) {
      return jsonErr(rid, "Validering feilet.", 422, "VALIDATION_FAILED", result.error.flatten());
    }

    return handler(result.data, { req, rid });
  };
}

export async function parseValidatedJson<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  req: NextRequest,
  rid: string
): Promise<{ ok: true; data: z.infer<TSchema> } | { ok: false; response: Response }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, response: jsonErr(rid, "Ugyldig JSON.", 400, "INVALID_JSON") };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      response: jsonErr(rid, "Validering feilet.", 422, "VALIDATION_FAILED", result.error.flatten()),
    };
  }
  return { ok: true, data: result.data };
}

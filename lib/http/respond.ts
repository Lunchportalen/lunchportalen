// lib/http/respond.ts
import "server-only";

import { NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/http/noStore";
import { opsLog } from "@/lib/ops/log";

function genRid() {
  const t = Date.now().toString(36);
  const r1 = Math.random().toString(36).slice(2, 10);
  const r2 = Math.random().toString(36).slice(2, 10);
  return `rid_${t}_${r1}${r2}`;
}

export function makeRid(): string {
  return genRid();
}

function normalizeError(err: unknown) {
  if (err === undefined) return "ERROR";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || "ERROR";
  if (err && typeof err === "object") {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string" && code) return code;
    const error = (err as { error?: unknown }).error;
    if (typeof error === "string" && error) return error;
  }
  return err;
}

export function jsonOk<T>(rid: string, data: T, status: number = 200): Response {
  try {
    return NextResponse.json({ ok: true as const, rid, data: data ?? null }, { status, headers: noStoreHeaders() });
  } catch {
    return NextResponse.json(
      { ok: false as const, rid: makeRid(), message: "Kunne ikke generere respons.", status: 500, error: "RESPOND_FAILED" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}

export function jsonErr(rid: string, message: string, status: number = 400, error?: unknown): Response {
  try {
    const errorOut = normalizeError(error);
    const payload = {
      ok: false as const,
      rid,
      message,
      status,
      error: errorOut,
    };

    if (status >= 500) {
      opsLog("incident", { rid, status, message, error: errorOut });
    }

    return NextResponse.json(payload, { status, headers: noStoreHeaders() });
  } catch {
    return NextResponse.json(
      { ok: false as const, rid: makeRid(), message: "Kunne ikke generere feilrespons.", status: 500, error: "RESPOND_FAILED" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}

// lib/http/fasit.ts
import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
export function rid() {
  return crypto.randomUUID();
}
export async function readJson(req: NextRequest) {
  const t = await req.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return {};
  }
}
export function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
export function jsonErr(status: number, r: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid: r, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

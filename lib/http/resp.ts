import crypto from "node:crypto";
import { NextResponse } from "next/server";

export function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
export function rid() {
  return crypto.randomUUID();
}
export function jsonOk(body: any, status = 200) {
  const ridVal = body?.rid || rid();
  if (body && typeof body === "object") {
    const { ok, rid: _rid, status: _status, data, ...rest } = body as any;
    const normalizedData = data ?? rest;
    return NextResponse.json({ ok: true, rid: ridVal, data: normalizedData, ...rest }, { status, headers: noStore() });
  }
  return NextResponse.json({ ok: true, rid: ridVal, data: body ?? null }, { status, headers: noStore() });
}
export function jsonErr(status: number, r: string, error: string, message: string) {
  return NextResponse.json({ ok: false, rid: r, error, message, status }, { status, headers: noStore() });
}

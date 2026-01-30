import crypto from "node:crypto";
import { NextResponse } from "next/server";

export function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
export function rid() {
  return crypto.randomUUID();
}
export function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
export function jsonErr(status: number, r: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid: r, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

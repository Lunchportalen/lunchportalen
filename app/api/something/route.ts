export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { handleSomething } from "@/lib/http/something";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const result = await handleSomething({
    userId: body.userId,
    payload: body.payload,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}

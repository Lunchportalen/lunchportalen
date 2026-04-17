// app/kitchen/print/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";

import KitchenPrintBody from "./KitchenPrintBody";

export default function KitchenPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-10 text-center text-sm text-slate-600">Laster utskrift…</div>
      }
    >
      <KitchenPrintBody />
    </Suspense>
  );
}

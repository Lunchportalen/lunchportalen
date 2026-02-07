import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bestillinger | Lunchportalen",
};

export default function OrdersPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Bestillinger</h1>
      <p className="mt-2 text-sm text-neutral-600">Denne siden er under oppsett.</p>
    </main>
  );
}

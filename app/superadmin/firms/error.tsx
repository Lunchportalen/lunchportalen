// app/superadmin/firms/error.tsx
"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Noe gikk galt</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => reset()}
          className="mt-4 inline-flex items-center rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          type="button"
        >
          Prøv igjen
        </button>
      </div>
    </div>
  );
}

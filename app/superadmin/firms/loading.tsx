// app/superadmin/firms/loading.tsx
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4">
        <div className="h-6 w-40 animate-pulse rounded bg-gray-100" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-gray-100" />
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="h-10 w-full animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-64 w-full animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}

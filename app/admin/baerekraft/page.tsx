// app/admin/baerekraft/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import AdminEsgClient from "./AdminEsgClient";
import DownloadEsgPdfButton from "./DownloadEsgPdfButton";

export default function AdminBerekraftPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Bærekraft</h1>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            Oversikt basert på faktiske bestillinger og avbestillinger. Kun tall – ingen ekstra valg.
          </p>
        </div>

        <div className="shrink-0">
          <DownloadEsgPdfButton />
        </div>
      </div>

      <AdminEsgClient />
    </main>
  );
}

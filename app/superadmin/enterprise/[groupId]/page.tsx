// app/superadmin/enterprise/[groupId]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import EnterpriseGroupClient from "./EnterpriseGroupClient";

type RouteCtx = { params: { groupId: string } };

export default async function SuperadminEnterpriseGroupPage({ params }: RouteCtx) {
  const groupId = params?.groupId ?? "";

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 lp-select-text">
      <header className="mb-6">
        <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Konsern-detaljer</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Oversikt over selskaper og lokasjoner i konsern.
        </p>
      </header>

      <section className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <EnterpriseGroupClient groupId={groupId} />
      </section>
    </main>
  );
}

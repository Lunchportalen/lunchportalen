// app/superadmin/esg/[companyId]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import SuperadminEsgClient from "./SuperadminEsgClient";

type Props = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function SuperadminEsgCompanyPage({ params }: Props) {
  const p = (await params) as { companyId: string };
  const companyId = p.companyId;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">ESG</h1>
        <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
          Firma: <span className="font-mono text-xs">{companyId}</span>
        </p>
      </div>

      <SuperadminEsgClient companyId={companyId} />
    </main>
  );
}

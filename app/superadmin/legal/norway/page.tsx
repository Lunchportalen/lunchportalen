export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { requireSuperadmin } from "@/lib/superadmin/auth";
import {
  NORWAY_LEGAL_STATUS,
  NORWAY_LEGAL_VERSION,
  buildNorwayLegalDocuments,
  NORWAY_REQUIRED_DOCS_BY_ROLE,
} from "@/lib/legal/norwayDocuments";
import { NorwayLegalInspectionClient } from "./NorwayLegalInspectionClient";

export default async function SuperadminNorwayLegalPage() {
  await requireSuperadmin();
  const docs = buildNorwayLegalDocuments().map((d) => ({
    documentType: d.documentType,
    version: d.version,
    checksum: d.checksum,
    effectiveDate: d.effectiveDate,
    title: d.title,
  }));

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-[27px]">
      <h1 className="text-2xl font-semibold tracking-tight">Norske vilkår — inspeksjon</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Read-only. Status: {NORWAY_LEGAL_STATUS}. Versjonspakke: {NORWAY_LEGAL_VERSION}. Superadmin kan ikke
        fabrikkere aksept.
      </p>

      <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Gjeldende dokumenter</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {docs.map((d) => (
            <li key={d.documentType} className="rounded-xl bg-neutral-50 px-3 py-2">
              <strong>{d.title}</strong> · {d.documentType} · v{d.version}
              <div className="text-xs text-neutral-500">checksum {d.checksum.slice(0, 16)}… · {d.effectiveDate}</div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-neutral-500">
          Provider krever {NORWAY_REQUIRED_DOCS_BY_ROLE.provider.length} · Company{" "}
          {NORWAY_REQUIRED_DOCS_BY_ROLE.company.length} · Employee {NORWAY_REQUIRED_DOCS_BY_ROLE.employee.length}
        </p>
      </section>

      <NorwayLegalInspectionClient />
    </div>
  );
}

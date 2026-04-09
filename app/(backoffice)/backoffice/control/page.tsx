export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { fetchRecentCeoLogs } from "@/lib/ai/ceo/ceoLog";
import { PageContainer } from "@/components/layout/PageContainer";
import { CmsDomainActionSurfaceCard } from "@/components/cms/control-plane/CmsDomainActionSurfaceCard";
import { CONTROL_PLANE_DOMAIN_ACTION_SURFACES } from "@/lib/cms/controlPlaneDomainActionSurfaces";
import { CONTROL_PLANE_RUNTIME_MODULES } from "@/lib/cms/controlPlaneRuntimeStatusData";
import { ControlRunClient } from "./ControlRunClient";

const GROWTH_MODULE_IDS = new Set(["seo", "social", "esg"]);

function formatPayload(p: Record<string, unknown>): string {
  try {
    const s = JSON.stringify(p);
    return s.length > 400 ? `${s.slice(0, 400)}…` : s;
  } catch {
    return "—";
  }
}

export default async function BackofficeControlPage() {
  const logs = await fetchRecentCeoLogs(80);

  return (
    <PageContainer className="max-w-[1440px] py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">AI CEO — kontroll</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Beslutninger, planlagte tiltak og logger. Alle handlinger er sporbare; automatisering muterer ikke CMS.
      </p>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="cp-runtime-bridge-heading">
        <h2 id="cp-runtime-bridge-heading" className="text-sm font-semibold text-slate-900">
          Operative tårn og runtime-sannhet
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Backoffice er kontrollplan for innhold og vekst. Ordre, avtaler, faktura og leveranser forblir i operative
          databaser og egne flater — åpne disse når du trenger systemstatus uten å flytte sannhet inn i CMS.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <li>
            <Link className="text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-600" href="/backoffice/domains">
              Domeneoversikt (orkestrering)
            </Link>
          </li>
          <li>
            <Link className="text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-600" href="/backoffice/customers">
              Kunder & avtaler (innsyn)
            </Link>
          </li>
          <li>
            <Link className="text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-600" href="/backoffice/runtime">
              Runtime-oversikt (aggregater)
            </Link>
          </li>
          <li>
            <Link className="text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-600" href="/backoffice/week-menu">
              Uke & meny (Sanity + kjede)
            </Link>
          </li>
          <li>
            <Link className="text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-600" href="/superadmin/companies">
              Firma (superadmin)
            </Link>
          </li>
          <li>
            <Link className="text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-600" href="/superadmin/system">
              Systemhelse
            </Link>
          </li>
          <li>
            <Link className="text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-600" href="/superadmin/overview">
              Oversikt
            </Link>
          </li>
          <li>
            <Link className="text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-600" href="/superadmin/invoices">
              Fakturagrunnlag
            </Link>
          </li>
          <li>
            <Link className="text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-600" href="/superadmin/growth/social">
              Social engine
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="cp-domain-actions-heading">
        <h2 id="cp-domain-actions-heading" className="text-sm font-semibold text-slate-900">
          Domenehandlinger (samme kjede som domeneoversikt)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Utdrag — full liste på <Link href="/backoffice/domains">/backoffice/domains</Link>.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONTROL_PLANE_DOMAIN_ACTION_SURFACES.slice(0, 6).map((surface) => (
            <CmsDomainActionSurfaceCard key={surface.id} surface={surface} />
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-slate-200 bg-slate-50/80 p-5" aria-labelledby="cp-growth-heading">
        <h2 id="cp-growth-heading" className="text-sm font-semibold text-slate-900">
          Growth-moduler — status (samme som toppstripe)
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {CONTROL_PLANE_RUNTIME_MODULES.filter((m) => GROWTH_MODULE_IDS.has(m.id)).map((m) => (
            <li key={m.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              <span className="font-medium text-slate-900">{m.label}</span>
              <span className="ml-2 font-mono text-[10px] text-slate-500">{m.badge}</span>
              <p className="mt-1 text-[11px] text-slate-500">{m.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 space-y-8">
        <ControlRunClient />

        <section>
          <h2 className="text-sm font-semibold text-slate-900">Siste hendelser</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {logs.length === 0 ? (
              <li className="px-4 py-6 text-sm text-slate-500">Ingen logger ennå.</li>
            ) : (
              logs.map((row) => (
                <li key={row.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{row.entry_type}</span>
                    <time className="text-xs text-slate-500" dateTime={row.created_at}>
                      {row.created_at}
                    </time>
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-500">rid: {row.rid}</p>
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                    {formatPayload(row.payload)}
                  </pre>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </PageContainer>
  );
}

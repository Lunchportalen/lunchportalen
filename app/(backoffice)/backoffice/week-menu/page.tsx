export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { BackofficeWorkspaceSurface } from "@/components/backoffice/BackofficeWorkspaceSurface";
import { CmsWeekRuntimeStatusPanel } from "@/components/cms/control-plane/CmsWeekRuntimeStatusPanel";
import { CmsWeekMenuPublishControlsPanel } from "@/components/cms/control-plane/CmsWeekMenuPublishControlsPanel";
import { CmsWeekMenuPublishOrchestrator } from "@/components/cms/control-plane/CmsWeekMenuPublishOrchestrator";
import { getMenusByMealTypes } from "@/lib/cms/getMenusByMealTypes";
import { FALLBACK_LUXUS_MEAL_KEYS } from "@/lib/cms/mealTierFallback";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import { getSanityStudioBaseUrl } from "@/lib/cms/sanityStudioUrl";

export default async function BackofficeWeekMenuPage() {
  const keys = [...FALLBACK_LUXUS_MEAL_KEYS].map((k) => normalizeMealTypeKey(k)).filter(Boolean);
  const menus = await getMenusByMealTypes(keys);
  const studioUrl = getSanityStudioBaseUrl();

  const pill =
    "inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50";

  return (
    <BackofficeWorkspaceSurface
      workspaceId="week-menu"
      title="Uke & meny"
      lead={
        <>
          <strong>Operativ ansatt-sannhet:</strong> <code className="rounded bg-slate-100 px-1">GET /api/week</code> bruker{" "}
          <code className="rounded bg-slate-100 px-1">company_current_agreement</code> + Sanity{" "}
          <code className="rounded bg-slate-100 px-1">menuContent</code> per dato — <strong>ikke</strong> Sanity{" "}
          <code className="rounded bg-slate-100 px-1">weekPlan</code> som primær kilde for bestilling (se kodekommentarer).
          <br />
          <span className="mt-2 block">
            <strong>Redaksjonell ukeplan:</strong> Sanity <code className="rounded bg-slate-100 px-1">weekPlan</code> + publish-API
            er eget spor (marketing/policy) — merket LIMITED i kontrollplan-status.
          </span>
        </>
      }
      publishHistoryNote={
        <>
          <strong>Publisering og historikk:</strong> operativ meny følger Sanity <code className="rounded bg-white px-1">menuContent</code>{" "}
          og eksisterende publish-API. Full versjonshistorikk for Sanity ligger primært i Studio. Innholdssider i Postgres har egen
          recovery/gjennomgang i innholdsworkspace — det finnes ikke én samlet tidslinje på tvers av kildene i denne flaten.
        </>
      }
      contextSummary={
        <>
          <strong className="font-medium text-slate-900">Operativ meny</strong> for ansatte kommer fra Sanity{" "}
          <code className="rounded bg-slate-100 px-1">menuContent</code> + avtale + <code className="rounded bg-slate-100 px-1">GET /api/week</code>.
          <strong className="font-medium text-slate-900"> Redaksjonell weekPlan</strong> er et eget spor (marketing) — ikke duplikat
          bestillingssannhet.
        </>
      }
      statusChips={[
        { label: "Operativ kilde: Sanity meny", tone: "success" },
        { label: "weekPlan: editorial / LIMITED", tone: "warning" },
      ]}
      toolbar={
        <>
          <a className={pill} href={studioUrl} target="_blank" rel="noopener noreferrer">
            Åpne Sanity Studio
          </a>
          <Link className={pill} href="/backoffice/runtime">
            Runtime-oversikt
          </Link>
          <Link className={pill} href="/backoffice/content">
            Content (Postgres)
          </Link>
        </>
      }
      secondaryActions={
        <Link className={`${pill} border-slate-200 bg-slate-50`} href="/backoffice/domains">
          Domener — kontrollplan
        </Link>
      }
      footerApps={
        <>
          <strong className="font-medium text-slate-900">Footer:</strong> publish av operativ meny skjer via Sanity (Studio eller
          server-broker). Historikk for menydokumenter: Studio. Ukeplan-relaterte felt som ikke styrer <code className="rounded bg-white px-1">GET /api/week</code> er
          merket tydelig i UI og i kontrollplan.
        </>
      }
    >
      <div>
        <CmsWeekMenuPublishOrchestrator studioUrl={studioUrl} mealKeys={keys} menus={menus} />
      </div>

      <div className="mt-8">
        <CmsWeekMenuPublishControlsPanel studioUrl={studioUrl} />
      </div>

      <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <strong>Editorial-only:</strong> <code className="rounded bg-white px-1">weekPlan</code> i Sanity er ikke{" "}
        <code className="rounded bg-white px-1">GET /api/week</code> for ansatte. Bruk Ukeplan i Studio-venstremeny for
        redaksjonell plan — ikke for å tolke som bestillbar uke.
      </div>

      <div className="mt-8">
        <CmsWeekRuntimeStatusPanel studioUrl={studioUrl} />
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-slate-900">Meny-dokumenter (Sanity, lest nå)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Vises via <code>getMenusByMealTypes</code> — samme klasse data som inngår i operative menyer. Tom celle betyr
          manglende dokument for nøkkel i miljøet.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Måltidstype</th>
                <th className="px-4 py-3">Tittel (Sanity)</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.map((k) => {
                const doc = menus.get(k);
                const title = doc?.title?.trim() || "—";
                return (
                  <tr key={k}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-800">{k}</td>
                    <td className="px-4 py-3 text-slate-800">{title}</td>
                    <td className="px-4 py-3 text-slate-600">{doc ? "Funnet i Sanity" : "Mangler dokument"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </BackofficeWorkspaceSurface>
  );
}

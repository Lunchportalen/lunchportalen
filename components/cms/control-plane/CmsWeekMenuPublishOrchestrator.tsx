import { CmsMenuPublishReadinessSummary } from "@/components/cms/control-plane/CmsMenuPublishReadinessSummary";
import { CmsMenuContentNativePublishPanel } from "@/components/cms/control-plane/CmsMenuContentNativePublishPanel";
import { CmsOperationalPublishChain } from "@/components/cms/control-plane/CmsOperationalPublishChain";
import { CmsSanityPublishHandoffCard } from "@/components/cms/control-plane/CmsSanityPublishHandoffCard";

type MenuDoc = { title?: string | null } | null | undefined;

type CmsWeekMenuPublishOrchestratorProps = {
  studioUrl: string;
  mealKeys: string[];
  menus: Map<string, MenuDoc>;
};

/**
 * CP6/CP7 — in-CMS publiseringsorkestrering: kjede → readiness → valgfri server-broker (menuContent) → Studio-handoff.
 */
export function CmsWeekMenuPublishOrchestrator({ studioUrl, mealKeys, menus }: CmsWeekMenuPublishOrchestratorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">In-CMS publiseringsorkestrering</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Én side eier fortellingen: kjede → beredskap → (valgfritt) publish via server-broker → handoff til Studio.
          Runtime og ansatt uke endres ikke her — de leser publisert sannhet som før.
        </p>
      </div>
      <CmsOperationalPublishChain studioUrl={studioUrl} />
      <CmsMenuPublishReadinessSummary mealKeys={mealKeys} menus={menus} />
      <CmsMenuContentNativePublishPanel />
      <CmsSanityPublishHandoffCard studioUrl={studioUrl} />
    </div>
  );
}

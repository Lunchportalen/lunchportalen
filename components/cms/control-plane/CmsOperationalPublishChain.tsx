import Link from "next/link";

import {
  OPERATIONAL_WEEK_MENU_PUBLISH_CHAIN,
  type OperationalWeekMenuPublishStep,
} from "@/lib/cms/operationalWeekMenuPublishChain";

type CmsOperationalPublishChainProps = {
  studioUrl: string;
};

function resolveHref(step: OperationalWeekMenuPublishStep, studioUrl: string): string | undefined {
  if (!step.actionHref) return undefined;
  if (step.actionHref === "__STUDIO__") return studioUrl;
  return step.actionHref;
}

/**
 * Én visuell operativ publish-kjede — ingen sideeffekter.
 */
export function CmsOperationalPublishChain({ studioUrl }: CmsOperationalPublishChainProps) {
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-labelledby="op-chain-heading"
    >
      <h2 id="op-chain-heading" className="text-sm font-semibold text-slate-900">
        Operativ publish-kjede (én kjede)
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Publish for operativ meny = Sanity (Studio og/eller in-CMS broker for menuContent — samme kilde). Runtime eier
        avtale og ordre-API. Ingen duplikat publish-motor i Postgres.
      </p>
      <ol className="mt-4 space-y-4">
        {OPERATIONAL_WEEK_MENU_PUBLISH_CHAIN.map((row) => {
          const href = resolveHref(row, studioUrl);
          return (
            <li key={row.step} className="flex gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800"
                aria-hidden
              >
                {row.step}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{row.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{row.detail}</p>
                {href && row.actionLabel ? (
                  <div className="mt-2">
                    {row.external ? (
                      <a
                        className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {row.actionLabel} ↗
                      </a>
                    ) : (
                      <Link
                        className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
                        href={href}
                      >
                        {row.actionLabel}
                      </Link>
                    )}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

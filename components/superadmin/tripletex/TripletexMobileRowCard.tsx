import type { ReactNode } from "react";

export default function TripletexMobileRowCard(props: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className="ds-card rounded-[var(--ds-radius-md)] p-4 text-center sm:text-left">
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[rgb(var(--lp-fg))]">{props.title}</h3>
          {props.subtitle ? (
            <p className="mt-1 break-all text-xs text-[rgb(var(--lp-muted))]">{props.subtitle}</p>
          ) : null}
        </div>
        {props.badge ? <div className="shrink-0">{props.badge}</div> : null}
      </div>
      {props.meta ? <div className="mt-3 grid gap-1 text-xs text-[rgb(var(--lp-muted))]">{props.meta}</div> : null}
      {props.actions ? <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">{props.actions}</div> : null}
    </article>
  );
}

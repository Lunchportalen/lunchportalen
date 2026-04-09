/**
 * Runtime-modulstatus for CMS control plane (ærlig merking).
 * Typer og liste er frie for enhetstester; server-wrapper i `controlPlaneRuntimeStatus.ts`.
 */
export type RuntimeModuleBadge = "LIVE" | "LIMITED" | "DRY_RUN" | "STUB";

export type ControlPlaneModuleStatus = {
  id: string;
  label: string;
  badge: RuntimeModuleBadge;
  detail: string;
};

export const CONTROL_PLANE_RUNTIME_MODULES: ControlPlaneModuleStatus[] = [
  {
    id: "content",
    label: "Innhold & tre",
    badge: "LIVE",
    detail: "Postgres content pages, tree og publish — kanonisk backoffice.",
  },
  {
    id: "media",
    label: "Media",
    badge: "LIVE",
    detail: "Backoffice media-bibliotek og publiserte referanser.",
  },
  {
    id: "week",
    label: "Ansatt uke (runtime)",
    badge: "LIVE",
    detail: "GET /api/week + Sanity meny/agreement — ikke Sanity weekPlan som operativ sannhet.",
  },
  {
    id: "weekplan_editorial",
    label: "Redaksjonell ukeplan",
    badge: "LIMITED",
    detail: "Sanity weekPlan + publish API — editorial/marketing, separat spor.",
  },
  {
    id: "seo",
    label: "SEO / vekst",
    badge: "LIMITED",
    detail: "Review-first; kombinasjon av editor og batch-skript.",
  },
  {
    id: "social",
    label: "Social publish",
    badge: "DRY_RUN",
    detail:
      "Ekstern publisering er ikke fullt produksjonskoblet (Meta Graph API-stub returnerer dry_run inntil nøkler finnes).",
  },
  {
    id: "esg",
    label: "ESG",
    badge: "LIMITED",
    detail: "Aggregater fra runtime; tolkning skal være review-first.",
  },
  {
    id: "worker",
    label: "Worker (e-post / AI-jobb / eksperiment)",
    badge: "STUB",
    detail: "workers/worker.ts — send_email, ai_generate og experiment_run er stub inntil implementert.",
  },
];

import GlobalControlTowerClient from "./GlobalControlTowerClient";

export default function GlobalControlTowerPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl font-semibold text-neutral-900">Global kontrolltårn</h1>
      <p className="max-w-2xl text-sm text-[rgb(var(--lp-muted))]">
        Flere markeder og agenter (CEO, Growth, Sales, Content) orkestreres deterministisk. Data isoleres per markeds-ID i
        pipeline-filter (kolonne eller meta). Ett marked feiler ikke for andre.
      </p>
      <GlobalControlTowerClient />
    </div>
  );
}

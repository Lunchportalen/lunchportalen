"use client";

import { useState } from "react";

export type AiCapabilityStatus = "loading" | "available" | "unavailable";

export type ContentAiToolsProps = {
  disabled?: boolean;
  aiCapabilityStatus?: AiCapabilityStatus;
  busyToolId?: string | null;
  errorMessage?: string | null;
  lastSummary?: string | null;
  lastBlockBuilderResult?: { block: Record<string, unknown>; message: string } | null;
  lastAppliedTool?: string | null;
  onImprovePage?: (input: { goal: "lead" | "info" | "signup"; audience: string }) => void;
  onSeoOptimize?: (input: { goal: "lead" | "info" | "signup"; audience: string }) => void;
  onGenerateSections?: (input: { goal: string; audience: string }) => void;
  onStructuredIntent?: (input: { variantCount: 2 | 3; target: "hero_cta" | "hero_only" }) => void;
  onLayoutSuggestions?: () => void;
  onBlockBuilder?: (input: { description: string }) => void;
  onImageGenerate?: (input: { purpose: "hero" | "section" | "social"; topic: string }) => void;
  onScreenshotBuilder?: (input: { screenshotUrl?: string; description?: string }) => void;
  onImageImproveMetadata?: (input: { mediaItemId: string; url: string }) => void;
};

const MAX_FIELD_PREVIEW = 80;

function BlockBuilderResultView({
  result,
}: {
  result: { block: Record<string, unknown>; message: string };
}) {
  const { block, message } = result;
  const type = typeof block.type === "string" ? block.type : "unknown";
  const id = typeof block.id === "string" ? block.id : "";
  const data = block.data != null && typeof block.data === "object" && !Array.isArray(block.data)
    ? (block.data as Record<string, unknown>)
    : null;
  const dataEntries = data ? Object.entries(data).filter(([, v]) => v != null && v !== "") : [];
  const truncate = (s: string) =>
    s.length <= MAX_FIELD_PREVIEW ? s : s.slice(0, MAX_FIELD_PREVIEW) + "…";

  return (
    <div className="space-y-1.5 text-right">
      <p className="text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">
        Generert blokk
      </p>
      <p className="text-xs font-medium text-[rgb(var(--lp-text))]">
        type: <span className="font-mono">{type}</span>
        {id ? ` · id: ${id.slice(0, 12)}…` : ""}
      </p>
      {message ? (
        <p className="text-xs text-[rgb(var(--lp-muted))]">{message}</p>
      ) : null}
      {dataEntries.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-left text-[10px] text-[rgb(var(--lp-muted))]">
          {dataEntries.slice(0, 8).map(([key, val]) => (
            <li key={key} className="flex gap-1">
              <span className="shrink-0 font-medium text-[rgb(var(--lp-text))]">{key}:</span>
              <span className="min-w-0 truncate">
                {typeof val === "string" ? truncate(val) : JSON.stringify(val)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <pre className="mt-1 max-h-32 overflow-auto rounded border border-[rgb(var(--lp-border))] bg-slate-50 px-2 py-1 text-left text-[10px] font-mono text-[rgb(var(--lp-text))] whitespace-pre-wrap break-all">
        {JSON.stringify(block, null, 2)}
      </pre>
    </div>
  );
}

export function ContentAiTools({
  disabled,
  aiCapabilityStatus = "loading",
  busyToolId,
  errorMessage,
  lastSummary,
  lastBlockBuilderResult,
  lastAppliedTool,
  onImprovePage,
  onSeoOptimize,
  onGenerateSections,
  onStructuredIntent,
  onLayoutSuggestions,
  onBlockBuilder,
  onImageGenerate,
  onScreenshotBuilder,
  onImageImproveMetadata,
}: ContentAiToolsProps) {
  const cardClass =
    "rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-3 space-y-2";
  const buttonClass =
    "mt-1 inline-flex items-center justify-center rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50";

  const [improveGoal, setImproveGoal] = useState<"lead" | "info" | "signup">("lead");
  const [improveAudience, setImproveAudience] = useState("");

  const [seoGoal, setSeoGoal] = useState<"lead" | "info" | "signup">("lead");
  const [seoAudience, setSeoAudience] = useState("");

  const [sectionsGoal, setSectionsGoal] = useState("");
  const [sectionsAudience, setSectionsAudience] = useState("");

  const [intentVariantCount, setIntentVariantCount] = useState<2 | 3>(2);
  const [intentTarget, setIntentTarget] = useState<"hero_cta" | "hero_only">("hero_cta");

  const [layoutFromLocale, setLayoutFromLocale] = useState("nb");
  const [layoutToLocale, setLayoutToLocale] = useState("en");

  const [imagePurpose, setImagePurpose] = useState<"hero" | "section" | "social">("hero");
  const [imageTopic, setImageTopic] = useState("");

  const [blockBuilderDescription, setBlockBuilderDescription] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [screenshotDescription, setScreenshotDescription] = useState("");
  const [metaMediaItemId, setMetaMediaItemId] = useState("");
  const [metaUrl, setMetaUrl] = useState("");

  const improveBusy = busyToolId === "content.maintain.page";
  const seoBusy = busyToolId === "seo.optimize.page";
  const sectionsBusy = busyToolId === "landing.generate.sections";
  const intentBusy = busyToolId === "experiment.generate.variants";
  const layoutSuggestionsBusy = busyToolId === "layout.suggestions";
  const blockBuilderBusy = busyToolId === "block.builder";
  const imageGenerateBusy = busyToolId === "image.generate.brand_safe";
  const screenshotBuilderBusy = busyToolId === "screenshot.builder";
  const imageMetaBusy = busyToolId === "image.improve.metadata";

  const allDisabled = disabled ?? false;

  return (
    <section className="mt-4 rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Neste beste handling</h3>
          <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
            Basert på sideaudit, struktur og AI-forslag. Ingen endringer publiseres uten at du lagrer siden.
          </p>
        </div>
        <div className="max-w-xs text-right space-y-1">
          {aiCapabilityStatus === "loading" ? (
            <p className="text-[10px] text-[rgb(var(--lp-muted))]">Sjekker AI-tilgjengelighet…</p>
          ) : aiCapabilityStatus === "unavailable" ? (
            <div className="space-y-1.5 text-right">
              <p className="inline-block rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                AI er ikke tilgjengelig (mangler serverkonfigurasjon).
              </p>
              <p className="text-[10px] text-[rgb(var(--lp-muted))]">
                Legg dette i <code className="rounded bg-slate-100 px-0.5 font-mono text-[10px]">.env.local</code> i prosjektroten.
              </p>
              <pre className="overflow-x-auto rounded border border-[rgb(var(--lp-border))] bg-slate-50 px-2 py-1 text-left text-[10px] font-mono text-[rgb(var(--lp-text))]">
                {"OPENAI_API_KEY=sk-...\nAI_PROVIDER=openai"}
              </pre>
              <p className="text-[10px] text-[rgb(var(--lp-muted))]">
                Bruk én av disse variantene. Alternativ: <code className="font-mono text-[10px]">AI_API_KEY=sk-...</code> og <code className="font-mono text-[10px]">AI_PROVIDER=openai</code>.
              </p>
              <p className="text-[10px] text-[rgb(var(--lp-muted))]">
                Start dev-serveren på nytt etter at du har lagret <code className="font-mono text-[10px]">.env.local</code>.
              </p>
            </div>
          ) : errorMessage ? (
            <p className="inline-block rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
              {errorMessage}
            </p>
          ) : lastBlockBuilderResult ? (
            <BlockBuilderResultView result={lastBlockBuilderResult} />
          ) : lastSummary ? (
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                Sist AI-kjøring
              </p>
              <p className="text-xs text-[rgb(var(--lp-muted))]">{lastSummary}</p>
              {lastAppliedTool && (
                <p className="text-[10px] text-[rgb(var(--lp-muted))]">
                  AI oppdaterte innholdet i editoren. Husk å lagre siden når du er fornøyd.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-[rgb(var(--lp-muted))]">
              Kjør Improve Page for å få forslag til forbedringer.
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Improve Page</p>
            <span className="inline-flex items-center rounded-full border border-[rgb(var(--lp-border))] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
              Anbefalt først
            </span>
          </div>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Analyserer hele siden og foreslår konkrete forbedringer før du publiserer eller deler.
          </p>
          <div className="mt-1 grid gap-1.5 text-xs">
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Mål</span>
              <select
                className="h-7 rounded border border-[rgb(var(--lp-border))] bg-white px-2 text-xs"
                value={improveGoal}
                onChange={(e) => setImproveGoal(e.target.value as "lead" | "info" | "signup")}
              >
                <option value="lead">Få forespørsler</option>
                <option value="info">Informasjon</option>
                <option value="signup">Registrering</option>
              </select>
            </label>
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Målgruppe (valgfritt)</span>
              <input
                className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                value={improveAudience}
                onChange={(e) => setImproveAudience(e.target.value)}
                placeholder="HR, ledelse …"
              />
            </label>
          </div>
          <button
            type="button"
            className={buttonClass}
            disabled={allDisabled || !onImprovePage || improveBusy}
            onClick={() =>
              onImprovePage?.({
                goal: improveGoal,
                audience: improveAudience.trim(),
              })
            }
          >
            {improveBusy ? "Kjører…" : "Kjør forbedringsforslag"}
          </button>
          <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
            Når det er trygt, oppdaterer AI blokker direkte i editoren. Husk å lagre siden for å gjøre endringene permanente.
          </p>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">SEO optimize side</p>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Hjelp til tittel, beskrivelse og nøkkelord uten å endre struktur.
          </p>
          <div className="mt-1 grid gap-1.5 text-xs">
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Mål</span>
              <select
                className="h-7 rounded border border-[rgb(var(--lp-border))] bg-white px-2 text-xs"
                value={seoGoal}
                onChange={(e) => setSeoGoal(e.target.value as "lead" | "info" | "signup")}
              >
                <option value="lead">Få forespørsler</option>
                <option value="info">Informasjon</option>
                <option value="signup">Registrering</option>
              </select>
            </label>
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Målgruppe (valgfritt)</span>
              <input
                className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                value={seoAudience}
                onChange={(e) => setSeoAudience(e.target.value)}
                placeholder="Beslutningstakere …"
              />
            </label>
          </div>
          <button
            type="button"
            className={buttonClass}
            disabled={allDisabled || !onSeoOptimize || seoBusy}
            onClick={() =>
              onSeoOptimize?.({
                goal: seoGoal,
                audience: seoAudience.trim(),
              })
            }
          >
            {seoBusy ? "Kjører…" : "Foreslå SEO-forbedringer"}
          </button>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Generate sections</p>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Utkast til nye seksjoner basert på kort beskrivelse.
          </p>
          <div className="mt-1 grid gap-1.5 text-xs">
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Mål</span>
              <input
                className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                value={sectionsGoal}
                onChange={(e) => setSectionsGoal(e.target.value)}
                placeholder="Få demo-forespørsler …"
              />
            </label>
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Målgruppe</span>
              <input
                className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                value={sectionsAudience}
                onChange={(e) => setSectionsAudience(e.target.value)}
                placeholder="HR, kontoransvarlig …"
              />
            </label>
          </div>
          <button
            type="button"
            className={buttonClass}
            disabled={allDisabled || !onGenerateSections || sectionsBusy}
            onClick={() =>
              onGenerateSections?.({
                goal: sectionsGoal.trim(),
                audience: sectionsAudience.trim(),
              })
            }
          >
            {sectionsBusy ? "Kjører…" : "Foreslå seksjoner"}
          </button>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Structured intent</p>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Strukturer brukerintensjon som grunnlag for A/B-varianter.
          </p>
          <div className="mt-1 grid gap-1.5 text-xs">
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Antall varianter</span>
              <select
                className="h-7 rounded border border-[rgb(var(--lp-border))] bg-white px-2 text-xs"
                value={intentVariantCount}
                onChange={(e) => setIntentVariantCount(Number(e.target.value) === 3 ? 3 : 2)}
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Målområde</span>
              <select
                className="h-7 rounded border border-[rgb(var(--lp-border))] bg-white px-2 text-xs"
                value={intentTarget}
                onChange={(e) =>
                  setIntentTarget(e.target.value === "hero_only" ? "hero_only" : "hero_cta")
                }
              >
                <option value="hero_cta">Hero + CTA</option>
                <option value="hero_only">Kun hero</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            className={buttonClass}
            disabled={allDisabled || !onStructuredIntent || intentBusy}
            onClick={() =>
              onStructuredIntent?.({
                variantCount: intentVariantCount,
                target: intentTarget,
              })
            }
          >
            {intentBusy ? "Kjører…" : "Generer A/B-varianter"}
          </button>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">AI Layout Suggestions</p>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Får layoutforslag basert på sidens blokker og tittel.
          </p>
          <button
            type="button"
            className={buttonClass}
            disabled={allDisabled || !onLayoutSuggestions || layoutSuggestionsBusy}
            onClick={() => onLayoutSuggestions?.()}
          >
            {layoutSuggestionsBusy ? "Kjører…" : "Hent layoutforslag"}
          </button>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">AI Block Builder</p>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Beskriv blokken du ønsker; AI foreslår en ferdig blokk.
          </p>
          <label className="mt-1 grid gap-0.5">
            <span className="text-[rgb(var(--lp-muted))]">Beskrivelse</span>
            <input
              className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
              value={blockBuilderDescription}
              onChange={(e) => setBlockBuilderDescription(e.target.value)}
              placeholder="F.eks. hero med overskrift og CTA"
            />
          </label>
          <button
            type="button"
            className={buttonClass}
            disabled={
              allDisabled ||
              !onBlockBuilder ||
              blockBuilderBusy ||
              !blockBuilderDescription.trim()
            }
            onClick={() =>
              onBlockBuilder?.({ description: blockBuilderDescription.trim() })
            }
          >
            {blockBuilderBusy ? "Kjører…" : "Bygg blokk"}
          </button>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">AI Image Generator</p>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Genererer merkevare-sikre bildeforslag lagret i mediearkivet.
          </p>
          <div className="mt-1 grid gap-1.5 text-xs">
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Formål</span>
              <select
                className="h-7 rounded border border-[rgb(var(--lp-border))] bg-white px-2 text-xs"
                value={imagePurpose}
                onChange={(e) =>
                  setImagePurpose(
                    e.target.value === "section"
                      ? "section"
                      : e.target.value === "social"
                      ? "social"
                      : "hero",
                  )
                }
              >
                <option value="hero">Hero</option>
                <option value="section">Seksjon</option>
                <option value="social">Sosiale medier</option>
              </select>
            </label>
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Tema</span>
              <input
                className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                value={imageTopic}
                onChange={(e) => setImageTopic(e.target.value)}
                placeholder="F.eks. firmalunsj på kontor"
              />
            </label>
          </div>
          <button
            type="button"
            className={buttonClass}
            disabled={allDisabled || !onImageGenerate || imageGenerateBusy || !imageTopic.trim()}
            onClick={() =>
              onImageGenerate?.({
                purpose: imagePurpose,
                topic: imageTopic.trim(),
              })
            }
          >
            {imageGenerateBusy ? "Kjører…" : "Foreslå bilder"}
          </button>
          <p className="mt-1 text-[10px] text-[rgb(var(--lp-muted))]">
            Bilder lagres som media-items. Du kan deretter velge dem i bilde-feltene.
          </p>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">AI Screenshot Builder</p>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Skjermbilde-URL eller beskrivelse gir en bootstrap med blokker.
          </p>
          <div className="mt-1 grid gap-1.5 text-xs">
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Skjermbilde-URL (valgfritt)</span>
              <input
                className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                value={screenshotUrl}
                onChange={(e) => setScreenshotUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Beskrivelse (valgfritt)</span>
              <input
                className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                value={screenshotDescription}
                onChange={(e) => setScreenshotDescription(e.target.value)}
                placeholder="F.eks. landing med hero og CTA"
              />
            </label>
          </div>
          <button
            type="button"
            className={buttonClass}
            disabled={
              allDisabled ||
              !onScreenshotBuilder ||
              screenshotBuilderBusy ||
              (!screenshotUrl.trim() && !screenshotDescription.trim())
            }
            onClick={() =>
              onScreenshotBuilder?.({
                screenshotUrl: screenshotUrl.trim() || undefined,
                description: screenshotDescription.trim() || undefined,
              })
            }
          >
            {screenshotBuilderBusy ? "Kjører…" : "Bygg fra skjermbilde"}
          </button>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-medium text-[rgb(var(--lp-text))]">Image metadata helper</p>
          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Bruker eksisterende bilder til å foreslå alt-tekst, bildetekst og tags.
          </p>
          <div className="mt-1 grid gap-1.5 text-xs">
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Media item ID</span>
              <input
                className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                value={metaMediaItemId}
                onChange={(e) => setMetaMediaItemId(e.target.value)}
                placeholder="UUID fra mediearkiv"
              />
            </label>
            <label className="grid gap-0.5">
              <span className="text-[rgb(var(--lp-muted))]">Bilde-URL (valgfritt)</span>
              <input
                className="h-7 rounded border border-[rgb(var(--lp-border))] px-2 text-xs"
                value={metaUrl}
                onChange={(e) => setMetaUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
          </div>
          <button
            type="button"
            className={buttonClass}
            disabled={
              allDisabled ||
              !onImageImproveMetadata ||
              imageMetaBusy ||
              (!metaMediaItemId.trim() && !metaUrl.trim())
            }
            onClick={() =>
              onImageImproveMetadata?.({
                mediaItemId: metaMediaItemId.trim(),
                url: metaUrl.trim(),
              })
            }
          >
            {imageMetaBusy ? "Kjører…" : "Foreslå metadata"}
          </button>
        </div>
      </div>
    </section>
  );
}

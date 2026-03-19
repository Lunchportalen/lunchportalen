# Page optimization motor — unified SEO, CRO, content

One engine evaluates a page for **what it is trying to achieve**, **SEO**, and **CRO**, and exposes how structure, content, and CTA interact.

## What is unified

- **Single evaluation**  
  One call runs both SEO and CRO analysis on the same page (blocks + meta). No separate “SEO tool” and “CRO tool” from the API’s perspective when using the unified endpoint.

- **Shared input**  
  Same input shape as SEO intelligence: `blocks`, `meta`, `pageTitle`, `locale`, `goal`, `brand`. One normalization of the page, then both pipelines run.

- **Combined response**  
  The editor receives:
  - **goal** — Page intent (lead / info / signup).
  - **seo** — Full `SeoIntelligenceResult`: score, suggestions, message, breakdown.
  - **cro** — Score, suggestions, breakdown (same as CRO scoring/suggestions modules).
  - **interplay** — Short, deterministic text on how SEO and CRO interact on this page (e.g. “CTA affects both…”, “Headline helps both…”).
  - **message** — One-line summary, e.g. “SEO 72, CRO 65. 4 SEO and 3 CRO suggestions.”
  - **evaluatedAt** — ISO timestamp.

- **Deterministic**  
  No LLM in the motor. It reuses `lib/seo` (page analysis, scoring, suggestions) and `lib/cro` (page analysis, scoring, suggestions). Same input ⇒ same output.

## What the editor receives

From **POST /api/backoffice/ai/page-intelligence** (same auth as seo-intelligence, body: blocks, meta, pageTitle, locale, goal, brand):

```ts
{
  goal: "lead" | "info" | "signup",
  seo: { score, suggestions, message, breakdown? },
  cro: { score, suggestions, breakdown },
  interplay: string,
  message: string,
  evaluatedAt: string
}
```

- **SEO suggestions** — Same structure as seo-intelligence (id, type, label, before, suggested, explanation, priority, status, metaField). Can be merged into `meta.seoRecommendations` as today.
- **CRO suggestions** — Same structure as CRO panel (type, category, target, targetBlockId, label, before, recommendedChange, rationale, priority, severity). Can be merged into `meta.croRecommendations` as today.
- **interplay** — For one “page understanding” copy or priority hint (e.g. fix CTA first because it affects both scores).

The editor can:
- Call **page-intelligence** once and show one “Page optimization” panel with both scores and a combined priority list, and use **interplay** for context.
- Or keep calling **seo-intelligence** and client-side CRO separately; both flows are unchanged.

## How SEO/CRO/content interplay is handled

- **In the motor**  
  `lib/optimization/pageOptimization.ts` runs `computeSeoIntelligence` and (analyzePageForCro + computeCroScore + buildCroSuggestions), then builds an **interplay** string from:
  - CTA: if SEO or CRO flagged missing/weak CTA → “CTA affects both…”
  - Title/description: if SEO breakdown has title/description deductions → “Title and meta description matter for search…”
  - Headline: if CRO has headline suggestions or SEO has heading deduction → “A clear headline helps both…”
  - Content depth / value props: if SEO content-depth or CRO value-props suggestions → “Content depth and value props…”

- **No new logic**  
  Interplay is derived from existing SEO and CRO results only. No extra analysis.

- **Content intelligence**  
  “Content” here is: body depth (SEO), value props and intro (CRO), and headline (both). There is no separate “content tool”; content signals are part of SEO and CRO. The unified motor is the single place that combines them for the editor.

## What remains separate on purpose

- **seo-intelligence route**  
  Still exists and unchanged. Editors that only need SEO can keep using it. No breaking change.

- **CRO in ContentWorkspace**  
  CRO analysis still runs client-side in the editor (analyzePageForCro, computeCroScore, buildCroSuggestions). Apply/dismiss and persistence (meta.croRecommendations) are unchanged. The unified API is an alternative way to get CRO (and SEO) in one call; the existing CRO panel does not have to use it.

- **lib/ai/cro/croEngine.ts**  
  The CRO engine (autoImproveCTAs, suggestScrollFlow, optimizeResponsiveLayout, etc.) is **not** part of the page optimization motor. The motor only uses deterministic CRO **scoring and suggestions** from `lib/cro` (pageAnalysis, scoring, suggestions). Rich CRO capabilities (e.g. scroll flow, layout) remain separate and can be invoked when the editor needs them.

- **Apply flows**  
  Applying SEO suggestions (meta seo.title / seo.description) and CRO suggestions (applyCroSuggestionToContent) is unchanged. The unified motor only returns suggestions; apply/dismiss stays in the editor and existing APIs.

## Files

- **lib/optimization/pageOptimization.ts** — Unified motor: `computePageOptimization(input)` → `PageOptimizationResult`.
- **app/api/backoffice/ai/page-intelligence/route.ts** — POST handler; auth and rate-limit aligned with seo-intelligence; logs to ai_activity_log with tool `page_intelligence`.
- **app/api/editor-ai/metrics/route.ts** — `page_intelligence` added to VALID_FEATURES for editor metrics.

## Summary

The AI no longer has to feel like “one SEO tool, one CRO tool, one content tool” when the editor uses the unified endpoint: one call returns goal, SEO, CRO, and how they interact. Existing SEO and CRO flows stay stable and can be migrated to the unified panel when desired.

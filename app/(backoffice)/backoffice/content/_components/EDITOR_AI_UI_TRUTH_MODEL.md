# Editor–AI UI truth model

**Purpose:** Editor AI UI states are truthful and explicit. We never imply successful action when state is ambiguous; loading, failure, success, and applied are clearly distinguished.

## 1. Loading state

- **Source:** `busyToolId` (and for page builder, `pageBuilderBusy ?? busyToolId === "page.builder"`).
- **Display:** Each AI action button shows a loading label only when that tool is busy (e.g. "Kjører…", "Genererer…", "Kjører sidediagnostikk…").
- **Rule:** Loading is shown only when the corresponding tool id is the current `busyToolId`. No generic "AI is thinking" without a specific action; no loading after the request has finished.

## 2. Failure state

- **Source:** `errorMessage` (and optional `onClearError`).
- **Display:** When `errorMessage` is non-null, a dedicated error block is shown: "AI-feil" plus the message and "Du kan prøve igjen eller lagre siden uten AI-endringer." No success styling; user can dismiss via "Lukk" if `onClearError` is provided.
- **Rule:** Error is shown only when the hook has set an error (API failure, parse failure, or apply failure). Clearing error is explicit (user or parent resets `errorMessage`).

## 3. Success and result panels

- **Success is not assumed:** We do not show a generic "Success" badge for AI. We show:
  - **Summary text** (`lastSummary`) in a neutral area ("Sist AI-kjøring") so the user sees what the last run produced. This can be a real summary or a skip message (e.g. "Innholdet har endret seg. Forslag ble ikke brukt.").
  - **"AI oppdaterte innholdet"** only when `lastAppliedTool` is set — i.e. only when we actually called the apply path. So we never claim content was updated when we skipped apply (stale, structure guard, or invalid patch).
- **Result panels:** Each builder (block, page, screenshot, layout) shows a result section only when there is a valid result to show:
  - Block builder: `lastBlockBuilderResult` (has `block` and `message`).
  - Page builder: `lastPageBuilderResult && lastPageBuilderResult.blocks.length > 0`.
  - Screenshot builder: result with blocks.
  - Layout suggestions: `lastLayoutSuggestionsResult && lastLayoutSuggestionsResult.suggestions.length > 0`.
- **Empty/unusable:** We do not show a result panel when the result is empty or unusable (e.g. no blocks, no suggestions). So we never show "Generert resultat" with 0 blocks.

## 4. Applied state

- **Diagnostics:** "Endringer er applisert i editoren" (and green check in the diagnostics section) is shown only when `diagnosticsResult.improvePage.applied || diagnosticsResult.seo.applied`. The top-right diagnostics summary uses the same rule: it shows "Endringer er applisert i editoren. Lagre siden for å beholde dem." only when at least one of improve/SEO was applied; otherwise "Se under for detaljer. Ingen endringer ble applisert automatisk."
- **Single-tool summary:** The line "AI oppdaterte innholdet i editoren. Husk å lagre..." is shown only when `lastAppliedTool` is set. `lastAppliedTool` is set only in the hook when we have actually called `onApplySuggestPatch` (or equivalent apply). So applied state is shown only when a suggestion was actually applied.
- **Builder apply:** Page/screenshot/block builder do not show an "applied" badge in the result panel; apply is user-triggered (Replace/Append/Insert). So there is no implied auto-apply success for builders.

## 5. Diagnostics summary condition

- **Before:** The diagnostics result summary (green box) was shown when `isDiagnosticsResult && lastSummary` (i.e. when the last applied tool was improve or seo). That could show "Endringer er applisert" even when the user had only run a single Improve/SEO action, not "Kjør sidediagnostikk", and could also show "Endringer er applisert" when neither improve nor seo had actually applied (e.g. no patch returned).
- **After:** The diagnostics summary is shown when `diagnosticsResult && lastSummary` — i.e. only when the full diagnostics result object exists (user ran "Kjør sidediagnostikk"). The text "Endringer er applisert i editoren..." is shown only when `diagnosticsResult.improvePage.applied || diagnosticsResult.seo.applied`; otherwise we show "Se under for detaljer. Ingen endringer ble applisert automatisk."

## 6. Retry / re-run

- **No automatic retry:** Failed requests do not auto-retry. The user sees the error and can "prøve igjen" by clicking the same (or another) action.
- **Explicit:** Buttons are re-enabled after the request finishes (success or failure). User can run the same or another tool again. No hidden retry logic; behavior is explicit and safe.

## 7. Capability and health

- **AI capability:** "AI: Tilgjengelig" / "AI: Sjekker…" / "AI: Ikke tilgjengelig" reflect the result of GET `/api/backoffice/ai/capability`. Loading is "Sjekker…"; we do not show "Tilgjengelig" until we have a successful response with `enabled: true`.
- **Media/Content health:** Same idea — checking / available / unavailable are explicit and not shown as success until the check has succeeded.

## 8. Summary

| State   | Shown when | Not shown as |
|---------|------------|--------------|
| Loading | That tool's `busyToolId` is set | Success or applied |
| Error   | `errorMessage` set | Success or applied |
| Summary | `lastSummary` set (any message, including skip) | Applied (unless `lastAppliedTool` set) |
| Applied | `lastAppliedTool` set or (diagnostics) `improvePage.applied \|\| seo.applied` | When no apply occurred |
| Result panel | Valid result (e.g. blocks.length > 0, suggestions.length > 0) | When result is empty or unusable |

All of the above keep UI truthful: we do not imply successful action when state is ambiguous, and we do not show empty or unusable output as success.

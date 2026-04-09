# U31 — Verification

**Commands run:**
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run build:enterprise` — PASS
- `npm run test:run` — PASS
- `npm run sanity:live` — PASS (soft gate; local `http://localhost:3000` was unreachable, script skipped as designed and exited `0`)

**Notes from verification:**
- `lint` still reports repo-wide warnings (`react-hooks/exhaustive-deps`, `@next/next/no-img-element`), but no blocking errors remain.
- A pre-existing blocking lint error in `app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx` was fixed by replacing a raw `<a>` with `Link`.

**Manual verification:**
- Not rerun in browser during this pass.
- Expected smoke path after merge: `/backoffice/content` landing, page editor tri-pane, footer apps, Settings section chrome, and preview toggle.

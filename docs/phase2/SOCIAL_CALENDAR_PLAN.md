# Phase 2 — Social calendar plan (repo-grounded)

**Goal:** One **professional** editorial calendar for Lunchportalen’s **own** channels (Facebook/Instagram), with generate → review → approve → publish — **no** parallel “AI social” silo.

## 1. Existing implementation (canonical)

| Piece | Location | Notes |
|-------|----------|--------|
| Calendar model | `lib/social/calendar.ts` | `CalendarPost`, parse/serialize |
| Browser persistence | `lib/social/calendarBrowserStorage.ts` | `lp_social_calendar_v2_*` prefix |
| UI component | `app/(backoffice)/backoffice/content/_components/SocialContentCalendar.tsx` | Embedded in CMS context; uses `calendarContent`, learning |
| Execution | `lib/social/executor.ts`, `revert.ts`, `scaling.ts` | Operational hooks |
| Growth automation | `lib/growth/growthAutomation.ts` | Uses calendar types |
| Redirect / tracking | `lib/social/unifiedGenerator.ts`, `mediaAdapter.ts` | Product links |

## 2. Current strengths

- **Single type** for posts (`CalendarPost`) consumed across engine, predictive, revenue tests.
- **CMS-adjacent UI** already lives under backoffice content components.

## 3. Gaps to close (Phase 2)

| Gap | Description | Mitigation |
|-----|-------------|------------|
| **Persistence** | Browser storage may not be enough for multi-editor teams | Move authoritative schedule to **Sanity document** or **server API** with tenant id — **decision needed** in implementation phase |
| **Approval** | “Rediger / slett / godkjenn” must be explicit state on each post | Add `status: draft | pending | approved | published` if not already enforced |
| **Asset parity** | AI-generated images must land in **same media system** as manual (Phase 2 stream C) | Single `mediaAdapter` path |
| **No duplicate UI** | Avoid second calendar under superadmin/growth unless it **delegates** to same lib | Reuse `SocialContentCalendar` or extract shared shell |

## 4. Boundaries

- **Not** employee-facing Week content.
- **Not** a new social network integration layer — use existing executor + redirect patterns.
- **Compliance:** Marketing copy still follows AGENTS.md S7 (no hype; truthful).

## 5. Dependencies

- `lib/social/calendar` stable API for posts
- CMS block/page context (`pageId`, `products`, `location` props on `SocialContentCalendarProps`)

## 6. Phase placement

- **2B** — after CMS boundary and media plan; may require **Sanity schema** touch — coordinate with `sanity:live` gate.

## 7. Next documents (later batch)

- `MEDIA_DATA_FLOW.md` — how generated assets attach to posts.
- `SEO_ENGINE_PLAN.md` — cross-link from social to landing URLs.

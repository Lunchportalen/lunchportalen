# What is missing to reach “100% Umbraco AI CMS” (literal product standard)

This list assumes the **hard** definition from the audit brief: **Umbraco is the CMS core**, with native backoffice, content model, governance, Delivery/Management APIs, and **AI integrated into Umbraco’s operational model** (e.g. Umbraco.AI / Developer MCP / Management-driven automation).

---

## Version / platform blockers

1. **No Umbraco host** — Entire .NET / ASP.NET Core / Umbraco web project (`.csproj`, `Program.cs`, `appsettings`, Umbraco packages) is **missing** from the repo (glob proof: zero `.csproj`).
2. **No Umbraco version** — Cannot select or certify Umbraco 13/17+ features, Bellissima backoffice, or official extension manifests.
3. **No Umbraco package graph** — No `PackageReference` to `Umbraco.Cms`, `Umbraco.Forms`, `Umbraco.Workflow`, `Umbraco.Deploy`, `Umbraco.Commerce`, `Umbraco.AI`, etc.

---

## CMS core blockers

4. **Document types / element types / compositions** — Not Umbraco; code-first registry with **one** canonical type (`page`) in `lib/cms/contentDocumentTypes.ts`.
5. **Persisted schema CRUD** — No Umbraco database model for document types, data types, or property editor metadata; parity docs state **replatforming** for Management API equivalence (`docs/umbraco-parity/U23_REPLATFORMING_GAPS.md`).
6. **Umbraco content tree** — Custom tree under backoffice; comments reference “Umbraco 13 parity” as **UX analogy** (`treeTypes.ts`), not product tree.

---

## Backoffice blockers (Umbraco-native)

7. **Official Umbraco backoffice shell** — Replaced by Next.js routes under `app/(backoffice)/backoffice/**`.
8. **Extension runtime** — Custom registries and React UI; matrix in `docs/repo-audit/U00R2_BELLISSIMA_EXTENSION_TYPE_MATRIX.md` lists **REPLATFORMING_GAP** items (e.g. entity bulk actions).

---

## Governance blockers (Umbraco-native)

9. **Umbraco Users / User Groups / node permissions** — Not present; app uses Supabase profiles + route guards (different contract than Umbraco permission model).
10. **Umbraco audit/version store** — Custom `lib/audit/**` and DB patterns; not interchangeable with Umbraco’s native history without migration.
11. **Umbraco Workflow (product)** — Not present; app has workflow **routes** but they are **application** workflow, not Umbraco Workflow licensing/features.

---

## Delivery blockers (Umbraco product APIs)

12. **Content Delivery API (Umbraco)** — **Absent**; public delivery via Next pages + `lib/cms/public/**` and related API routes (**shadow** delivery).
13. **Media Delivery API (Umbraco)** — **Absent**; app-specific media pipeline.
14. **Formal preview contract** — Partial; tests and docs note trust gaps (`docs/audit/full-system/UMBRACO_GAP_REPORT.md`).

---

## AI blockers (relative to “Umbraco AI CMS”)

15. **Umbraco.AI** — Not in dependencies; AI is implemented as **Next.js API routes** (`app/api/backoffice/ai/**`, `app/api/ai/**`, etc.) and `lib/ai/**`.
16. **AI ↔ Umbraco operations** — AI cannot call Umbraco Management API / content service because **Umbraco does not exist** in this repo.
17. **Developer MCP (Umbraco)** — **No** repository evidence of Model Context Protocol integration (`modelcontextprotocol` search: no matches in tracked TS/JSON/MD/YML scope).

---

## Operations / evidence blockers (for claiming “100%”)

18. **Single-name “CMS” identity** — Operational truth is **multi-store** (Postgres content + Sanity Studio configs under `studio/**` per `package.json` / docs).
19. **Surface area** — Hundreds of API routes (`569` under `app/api`) and large `lib/ai` tree increase **governance and review** cost — not a Umbraco blocker, but blocks **naive** “100% controlled” claims without exhaustive route proofs.

---

## If the goal is parity without replatforming

The repository **already contains** honest parity/gap analysis (`docs/umbraco-parity/**`, `docs/repo-audit/U00R2_*.md`, `docs/audit/full-system/UMBRACO_GAP_REPORT.md`). “100% Umbraco AI CMS” in the **literal** sense still requires either:

- **Replatforming** to Umbraco (new .NET host + data migration + delivery strategy), **or**
- **Renaming the goal** to “Umbraco-*inspired* editorial platform on Next/Supabase” (already partially documented).

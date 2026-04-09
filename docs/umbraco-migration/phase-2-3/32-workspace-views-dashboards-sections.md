# Workspace Views, Dashboards, and Sections

**Terminology:** Umbraco “content apps” are **Workspace Views** in current product language. Use **Workspace View** below.

## 1. Stock coverage (no custom code)

| Task | Stock Umbraco |
|------|----------------|
| Edit page properties + blocks | Default **Content** workspace |
| Upload/replace media | **Media** section |
| Culture switch / fall back | Built-in variant controls |
| Workflow transitions | Workflow panel / dashboard |
| User/group admin | **Users** section |
| Audit trail | **History** / audit features |
| Search | Global search |

## 2. Candidate extensions

| Candidate | Purpose | Role | Problem | Stock alternative | Decision | Confidence |
|-----------|---------|------|---------|-------------------|----------|------------|
| **Workspace View: “SEO summary”** | Surface key SEO fields in one column | Author/Editor | Long scroll | **Tabs** on Document Type composition | **Reject** — use composition groups | High |
| **Workspace View: “Block outline”** | Jump-to-block | Editor | Large pages | Block List labels + collapse | **Reject** initially | Medium |
| **Workspace View: “Related pages”** | Incoming links | Editor | Orphans | List View + manual “related” picker | **Reject** | High |
| **Dashboard: “My open drafts”** | Personal queue | Author | — | Workflow **built-in** “My tasks” | **Reject** custom | High |
| **Dashboard: “Site health” (broken links)** | QA | Editor | Quality | External crawler + manual report **or** Phase 4 Next job | **Reject** in Umbraco for Phase 3 | High |
| **Custom Section: “Marketing HQ”** | Aggregate tools | Editor | — | **Content** + **Media** | **Reject** | High |
| **Custom Section: “AI Studio”** | AI tools | Author | Centralize AI | Umbraco **approved** AI packages in **existing** workspace | **Reject** unless vendor requires Section | Medium |
| **Workspace View: “Form picker”** | Pick `formId` from manifest | Author | Free-text error | **Custom Property Editor** (single field) preferred over Workspace View | **Prefer Property Editor** over View | Medium |

## 3. Explicitly NOT justified (Phase 3)

- Custom **Section** for content that belongs in **Content**.
- Dashboard showing **analytics** (use product analytics tools).
- Workspace View duplicating **Workflow** panel.

## 4. If future proof is needed

Re-evaluate **one** Workspace View after **3 months** of editor telemetry — only with ticket citing measurable minutes saved.

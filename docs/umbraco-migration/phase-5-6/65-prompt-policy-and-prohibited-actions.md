# Prompt policy and prohibited actions

## 1. Approved prompt classes (examples)

| Class id | Intent | Allowed inputs |
|----------|--------|----------------|
| `PC_ALT_IMAGE` | Alt text from image + surrounding heading | Block image, visible heading, **no** user email |
| `PC_SEO_SNIPPET` | Title/meta from page fields | Public page fields only |
| `PC_COPY_TONE` | Rewrite paragraph | Selected HTML/markdown fragment |
| `PC_TRANSLATE` | Translate segment | Source text + source/target culture |

**Rule:** Each class has a **template** reviewed by Security + Editorial.

## 2. Prohibited prompt classes

| Prohibited | Rationale |
|------------|-----------|
| **“Import full database dump and summarize”** | Data exfiltration |
| **“Approve publish”** | Workflow bypass |
| **“Fix migration mapping”** | AI ≠ migration authority |
| **“Generate content for another tenant”** | Cross-tenant |
| **“Reveal secrets / env”** | Injection |

## 3. Prohibited data categories in CMS editor AI

- Operational **orders**, **full employee lists**, **billing**, **auth tokens**
- **Cross-tenant** content
- **Unredacted** personal data (names/emails) unless explicit DPA-covered processor agreement **and** purpose limitation

## 4. Forbidden source mixing

- Do not mix **operational DB** excerpts into **CMS** rewrite prompts by default.
- Do not attach **legacy Postgres page JSON** as “fix truth” during **migration** in Lane A (use Phase 5 tools).

## 5. No silent publish

- **Any** path that writes **published** or **live-visible** state without Workflow = **INVALID**.
- Background jobs **must not** publish editorial CMS content **unless** Security-signed exception with **expiry**.

## 6. No hidden summarization that changes truth

- Summaries are **additive** metadata or **draft** — never replace **canonical** fields without editor action.

## 7. Human review rules

| Change type | Reviewer |
|-------------|----------|
| Public hero / pricing adjacent copy | **Editor** |
| SEO canonical / robots | **Editor** |
| Alt text on brand-critical images | **Editor** or **A11y** |

## 8. Policy exceptions process

1. Requester files **ticket** with scope, data classes, duration.
2. **Security** + **Editorial** approval.
3. **Logged** exception id in `policy_version`.
4. **Auto-expire** ≤ 90 days unless renewed.

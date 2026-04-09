# ETL design — idempotency, replay, dry-run

**Design only.** No execution instructions for live data; no code in this pack.

## 1. Extraction strategy

| Aspect | Rule |
|--------|------|
| **Source** | Postgres primary; optional read replica for large pulls |
| **Scope filter** | Only rows belonging to **in-scope** tree roots and document families per `51` |
| **Consistency** | Snapshot boundary: either **per-run timestamp** + changelog, or **DB snapshot** for full loads — **document** chosen approach per environment |
| **Secrets** | DB credentials **server-side only**; never browser |
| **Rate** | Throttle to protect Supabase/Umbraco; **batch size** configurable |

## 2. Transformation strategy

| Aspect | Rule |
|--------|------|
| **Authority** | Transform rules **only** from signed manifest (`52`); ad-hoc scripts **invalid** without manifest update |
| **Blocks** | Type-by-type mappers; unknown type → **quarantine queue** (no silent drop) |
| **Media** | Resolve → import → attach UDI; **no** hard-coded production URLs in content |
| **Locales** | Map per **signed** B2 policy; fail closed if culture missing |
| **AI** | **Not** part of default transform pipeline; optional offline assist **post-extract** with human diff — see boundary contract |

## 3. Load strategy

| Mode | Use |
|------|-----|
| **Upsert by stable key** | Prefer **legacy id → Umbraco key** mapping table as join key |
| **Create-only first** | Initial staging load may create nodes then **switch to update** |
| **Workflow** | Loads land in **draft** / **import** state; **no** automated publish to live without human Workflow (program lock) |
| **Management API** | Server-side automation with **dedicated API User** (Phase 6 scopes) — **not** editor session in batch jobs |

## 4. Identity mapping rules

| Legacy | Target |
|--------|--------|
| `content_pages.id` | Row in **migration_mapping** (name TBD): `legacy_page_id`, `umbraco_key`, `last_run_id` |
| Block instance id | **Not** preserved in content; optional **sidecar** for debugging |
| Media file | `legacy_url` / hash → `umbraco_media_key` |
| Slug + parent + culture | Composite **natural key** for idempotent upsert **after** first mapping exists |

## 5. Idempotency rules

1. **Same input snapshot + same manifest version** ⇒ **same** Umbraco node keys (no duplicate siblings) when re-run.
2. **Updates** touch only properties defined in manifest; **no** wipe of unrelated Umbraco fields.
3. **Deletes** on source **do not** auto-delete in Umbraco unless **explicit** “tombstone” policy is signed (default: **manual review** for delete).

## 6. Replay rules

| Scenario | Behavior |
|----------|----------|
| **Mapper bug fixed** | Replay **affected** legacy ids only; bump `manifest_version` |
| **Target model change** | **Stop** — Phase 2–3 change control first; then remap |
| **Partial batch failure** | Resume from **checkpoint** (below) |

## 7. Dry-run mode

| Requirement | Detail |
|-------------|--------|
| **Output** | Diff report: would-create / would-update / would-skip / would-quarantine |
| **Side effects** | **Zero** writes to Umbraco live; **zero** legacy writes |
| **Artifacts** | JSON/CSV diff stored in secure artifact store with **retention policy** |

## 8. Checkpointing

- Persist **last successful legacy id** or **cursor** per subtree.
- Store **run id**, **git sha** of manifest, **environment** name.
- On restart, **resume** from checkpoint or **explicit** `--from` with approval.

## 9. Partial failure handling

| Failure type | Action |
|--------------|--------|
| **Single record validation** | Quarantine + continue (configurable threshold) |
| **API rate limit** | Backoff; resume |
| **Auth / scope error** | **Abort** run (fail closed) |
| **Above threshold** | Abort entire stage; notify on-call |

## 10. Audit log expectations (migration runs)

Each run logs: **run id**, **actor** (service identity), **environment**, **manifest version**, **counts** (ok/quarantine/fail), **start/end**, **error fingerprints**.  
Retention and sink = **manual platform** per `71`. Umbraco **native** audit covers **post-import** editorial actions.

## 11. Forbidden

| Forbidden | Why |
|-----------|-----|
| Non-idempotent “create new page every run” | Drift and duplicate URLs |
| Undocumented normalization | Violates “no hidden transforms” |
| Browser-based batch load with editor cookie | No attribution / secret exposure |
| Auto-publish to live | Workflow bypass |
| Embedding AI rewrite in default load | AI ≠ migration authority |

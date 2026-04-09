# U37 Execution Plan

## Goal
- Close the remaining control-plane and runtime gaps that still make the backoffice feel custom instead of Bellissima-like.
- Land real runtime corrections before UI polish: publish audit contract, system settings baseline truth, ESG schema drift, and operator-grade degraded states.

## Structural Gaps To Close Now
- `ContentWorkspace.tsx` still depends on competing block/create/catalog truths and compat import layers.
- Settings has strong read-models, but `system` still behaves like a side route instead of a first-class managed workspace.
- Document types, data types, schema/preset mapping, and create policy must stay code-governed but feel like explicit management objects.
- Tree/audit/runtime surfaces still need clearer operator messaging and tighter schema-truth handling.

## Build Order
1. Land runtime truth corrections in publish, settings, ESG, and degraded read routes.
2. Replace duplicate block registries/create options with one canonical catalog and one block creation path.
3. Remove or neutralize competing compat files that still obscure workspace ownership.
4. Tighten settings registry/workspace posture so management objects read as first-class surfaces.
5. Add focused regression tests for the new runtime and control-plane contracts.
6. Run `typecheck`, `lint`, `build:enterprise`, and `test:run`.

## Acceptance
- No publish path writes audit actions that violate DB constraints.
- `system_settings` can be read honestly even when the table/row is missing, and settings management uses one canonical route surface.
- ESG latest-monthly reads one canonical shape, with explicit degraded fallback for legacy columns.
- Block discovery, create defaults, and editor block creation share one canonical registry.
- Settings shows runtime-managed vs code-governed truth explicitly, without fake CRUD.

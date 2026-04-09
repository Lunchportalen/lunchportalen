# Phase 5 ↔ Phase 6 boundary contract

## 1. What Phase 5 may ask of Phase 6

| Ask | Limit |
|-----|-------|
| **API User** definitions for **migration ETL** service accounts | Scopes **only** for draft upsert on agreed subtree; **no** editorial AI features |
| **Logging sink** alignment | Same correlation id format where ETL and AI coexist in logs |
| **Kill-switch** coordination | Global “disable risky automation” may include **pausing ETL jobs** — **separate** flag from editor AI preferred |

## 2. What Phase 6 may ask of Phase 5

| Ask | Limit |
|-----|-------|
| **No AI output** carried as canonical migrated fields | Confirmed in manifest (`seoRecommendations`, `diagnostics` DROP default) |
| **Mapping table** clarity | So automation does not guess identities |
| **Quarantine** semantics | So editor AI never “fixes” unknown blocks without human triage |

## 3. What neither phase may change

- Phase 2–3 **content model**, **Workflow** stages, **field ownership**
- Phase 4 **Delivery / Preview / Media / cache / webhook** contracts
- **Operational** domain boundaries
- **Sole Umbraco authority** after cutover

## 4. Forbidden overlaps

| Anti-pattern | Correct split |
|--------------|---------------|
| **AI decides migration truth** | Phase 5 manifest + ETL only; AI optional **offline** diff, human-signed |
| **Migration engine bypasses Workflow** | ETL loads **draft**; publish via **human** Workflow |
| **AI automation writes outside scope** | API User scopes in `63`; subtree + DT allowlist |
| **ETL using browser or editor credentials** | Dedicated API User or server job identity |
| **Policy work silently changing migration scope** | Any scope change = **manifest** + **disposition register** change control |

## 5. Handoff points

| Event | Handoff |
|-------|---------|
| **Staging first load complete** | Phase 5 parity report → Editorial for **Umbraco** QA (Phase 7) |
| **Editor AI enabled on staging** | Phase 6 verifies **no** publish path; **Workflow** intact |
| **Freeze declared** | Phase 5 freeze spec → Engineering implements guards; Phase 6 irrelevant except audit |
| **Cutover** | **Phase 7+** — neither Phase 5 nor 6 “owns” cutover |

## 6. Signoff interlock

Both **Phase 5** and **Phase 6** exit checklists may be signed **in parallel** only if **`72`** has **no** unresolved cross-phase contradictions.

# U38 Management Object Model

## First-Class Objects In Scope

- `Document types`: collection + detail workspace + direct workspace/governance links.
- `Data types`: collection + detail workspace + explicit related document types and UI mappings.
- `Schema`: aggregated system view for field kinds, configured instances, presets, and unsupported create options.
- `Create policy`: policy workspace linked from document types and settings section.
- `Governance insights` / `AI governance`: still read-heavy, but now live in the same object model and routing posture as the other settings workspaces.

## Honesty Rules

- Code-governed objects stay code-governed.
- Persisted runtime objects stay runtime-managed.
- No fake CRUD is introduced where the system still reads from code.

## U38 Outcome

- Settings pages now describe object flow, not only object inventory.
- Content workspace governance points editors into the same management objects that settings exposes.
- Registry and tabs use the same source, reducing “which file owns this?” uncertainty.

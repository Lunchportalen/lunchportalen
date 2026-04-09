# U38 Entity Actions Collections Runtime

## Landed

- Workspace entity actions now include `management` and `schema` when a document type is present.
- Workspace footer apps now include a direct schema shortcut.
- Settings section tabs derive from the same registry-backed collection model.

## Why It Matters

- Tree/discovery/workspace/settings patterns are closer to one action language.
- Settings collection routing no longer has a separate tab truth.
- Editors can move from entity workspace to governance surface without guessing where the system wants them to go.

## Remaining Gap

- U38 tightens action semantics inside the content/settings line, but it does not yet deliver a unified bulk-action model across every management surface.

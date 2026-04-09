# U38 Management Objects Runtime

## Landed

- Document type workspaces now expose management flow cards, configured instances, presets, coverage gaps, and direct route-outs.
- Data type workspaces now expose configured-instance cards, UI mappings, and related document types.
- The content workspace governance rail points back to the same management objects that settings exposes.

## Result

- Settings behaves more like a control plane and less like a documentation shelf.
- Document types and data types now read as managed objects with relationships, not isolated read models.

## Honesty Boundary

- These objects are still primarily code-governed.
- U38 makes the governance model explicit in UI; it does not pretend persisted CRUD exists where it does not.

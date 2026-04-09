# U38 Editor Convergence Runtime

## Landed

- Removed the mounted `BlockAddModal` path from the canonical modal stack.
- Removed `addBlockModalOpen` state and prop wiring from the workspace root and UI-state hook.
- Kept block insertion on one visible line through `BlockPickerOverlay`.
- Added governance links from the editor rail back into document types, schema, and data types.

## Why It Matters

- The editor no longer advertises two competing insert surfaces.
- Workspace truth is easier to follow because settings/governance actions now live in the same shell model as the editor actions.
- `ContentWorkspace.tsx` lost active orchestration responsibility instead of growing another compat branch.

## Remaining Weakness

- `ContentWorkspace.tsx` is still a large composition root and should not be claimed “fully Bellissima” until more shell composition moves outward.

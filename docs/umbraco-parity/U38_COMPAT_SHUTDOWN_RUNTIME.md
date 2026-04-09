# U38 Compat Shutdown Runtime

## Shut Down

- Mounted `BlockAddModal` path in the canonical editor flow.
- `addBlockModalOpen` state and setter across the workspace root, modal shell props, and UI state hook.
- Compat export for `BlockAddModal` from `_stubs.ts`.
- Separate settings-tab definition disconnected from the canonical collection registry.

## Boxed In

- Existing compat helpers that remain are now thin adapters instead of competing owners.
- Old block-add code can no longer win at runtime through the canonical workspace stack.

## Outcome

- Less ownership ambiguity around block insert, settings tabs, workspace actions, and governance links.

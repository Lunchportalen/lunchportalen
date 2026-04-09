# U37 Property Editor System Model

## Four Layers
1. Schema
   - Field kind and validation contract.
2. Configured instance
   - A concrete field on a block or document composition.
3. UI mapping
   - The editor surface that renders the configured instance.
4. Preset / default
   - The default value payload that shapes initial editor state.

## U37 Rule
- Settings must show these layers as related but distinct objects.
- Document types link to configured instances and presets.
- Data types link to configured instances and UI mappings.
- The schema workspace shows the full system graph.

## Editor Rule
- Content workspace may show governance context, but must not redefine schema truth.
- Block creation defaults must come from the same canonical property/block catalog the settings surfaces read.

## Honesty
- No separate persisted “data type database” is introduced.
- The system remains code-governed unless a runtime-managed surface already exists.

# U38 Next Steps

## Immediate

1. Provide a valid superadmin session and capture every required screenshot into `docs/umbraco-parity/u38-screen-proof/`.
2. Review the captures against `U38_SCREEN_PROOF_REQUIREMENTS.md` and update `U38_SCREEN_PROOF.md` from pending to evidenced.
3. Re-evaluate `U38_TRAFFIC_LIGHT_MATRIX.md` after screen proof and downgrade/upgrade statuses honestly.

## Next Structural Move

1. Keep shrinking `ContentWorkspace.tsx` so shell composition and orchestration are easier to reason about.
2. Continue standardizing entity actions and collection behaviors across settings, discovery, tree and workspace headers.
3. Only introduce persisted lifecycle for document/data type objects if a real backend contract is added; do not fake CRUD.

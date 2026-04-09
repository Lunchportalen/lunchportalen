# U38 Open Risks

## Blocking / High

- Required screenshot proof is still missing because no valid local superadmin credentials are available.
- `ContentWorkspace.tsx` is still a large composition root and remains the clearest structural risk to full Bellissima closure.

## Medium

- Document types, data types and preset flows are explicit in UI, but still primarily code-governed and read-mostly.
- Entity actions and collection behaviors are stronger, but still not fully uniform across tree, discovery, settings and all detail workspaces.
- ESG is more honest after `query_failed`, but still `LIMITED` in the posture model and should not be over-sold as fully reliable analytics truth.

## Low / Explicitly Boxed

- `BlockAddModal.tsx` still exists in the repo as a non-mounted leftover because the worktree already had nearby edits; runtime truth no longer depends on it.
- `login-debug` is now safer locally, but it is only a support tool and not a substitute for a real verified superadmin session.

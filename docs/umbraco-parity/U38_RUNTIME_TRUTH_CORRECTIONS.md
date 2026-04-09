# U38 Runtime Truth Corrections

## Corrected In U38

- Page PATCH now preserves existing envelope metadata when only blocks are patched.
- Publish route returns a flat, clean payload that matches the locked API shape more honestly.
- Global settings POST is now superadmin-gated.
- Public global settings response includes `x-rid`.
- `getSettings()` now returns fail-closed settings instead of `null`.
- ESG monthly helpers distinguish legacy-column fallback from real query failure and surface `query_failed`.

## Why These Corrections Matter

- They remove silent metadata loss.
- They stop CMS control-plane writes from pretending to be open public writes.
- They prevent false-green ESG behavior when the source query actually failed.
- They make request tracing consistent in the public read path.

## Still Required For Full Proof

- Real UI screenshots of degraded tree/audit states.
- Manual confirmation of the authenticated settings write path in a valid superadmin session.

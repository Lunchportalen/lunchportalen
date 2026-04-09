# U25 — Open risks

1. **Legacy bodies** in DB without `documentType` — editors may misunderstand allowlist until they set DT and save.
2. **POST `body` abuse** — mitigated by validation; monitor 400 rates if clients send junk.
3. **Duplicate guard** is client-only until save — server PATCH remains source of truth (intentional).
4. **Replatforming** — any request for editable document types in DB needs schema + API design, not a quick patch.

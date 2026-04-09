# U25 — Create wizard runtime

## Flow

1. User opens create panel → **choose** or direct **form** (depending on tree context).
2. Choosing an alias sets `createDocumentTypeAlias` and moves to form.
3. Submit sends `POST` with `{ title, slug, body? }` where `body` is envelope when alias set.
4. Server **always** stores a valid envelope (default `page` if body omitted).

## Honesty

- Empty `allowedChildTypes` still means “no create under this parent context” — not bypassed by U25.

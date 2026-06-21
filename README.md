# Lunchportalen

Firmalunsj med kontroll, forutsigbarhet og bærekraft. RC-gates enforced in CI.

## Architecture

This repository is a monorepo containing two deployable systems:

- **app.lunchportalen.no** — Next.js application (Vercel, Supabase, Sanity)
- **lunchportalen.no** — Umbraco 17 marketing site (Azure App Service, Azure SQL)

See [docs/architecture/monorepo.md](docs/architecture/monorepo.md) for layout, deploy pipelines, data stores, and CI/CD.

## Documentation

Repository documentation: [docs/README.md](./docs/README.md) · [docs/CONVENTIONS.md](./docs/CONVENTIONS.md)

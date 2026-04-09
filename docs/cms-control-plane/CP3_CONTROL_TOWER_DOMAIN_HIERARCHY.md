# CP3 — Control tower domain hierarchy

**Fortelling:** Én **CMS control plane** (backoffice) orkestrerer **innsikt og navigasjon**; operative tårn forblir **egne runtime-flater** med egen sannhet.

## Hierarki (konseptuelt)

```
CMS Control Plane (backoffice)
├── Innhold & tre / media / design scopes (LIVE)
├── Domeneoversikt (/backoffice/domains) — runtime snapshot + modulstatus
├── Uke & meny (/backoffice/week-menu) — operativ kjede forklart
├── Kunder & avtaler (/backoffice/customers) — read-only speil
├── SEO / Social / ESG — growth-moduler med ærlige badges
└── Lenker til operative tårn (mutasjonssannhet)
    ├── Company admin → /admin/*
    ├── Kitchen → /kitchen/*
    ├── Driver → /driver/*
    └── Superadmin → /superadmin/*
```

## Implementasjon (CP3)

- **`TopBar`:** Faner Domener, Kunder, Uke & meny blant øvrige moduler.
- **`/backoffice/control`:** Seksjon «Operative tårn og runtime-sannhet» med lenker til domener, kunder, runtime, week-menu, superadmin.
- **`RuntimeDomainLinkCard`:** Felles mønster for LIVE/LIMITED/DRY_RUN/STUB.
- **Ingen** flytting av auth eller roller inn i CMS — kun navigasjon og forklaring.

## Kilde

- `app/(backoffice)/backoffice/control/page.tsx`
- `app/(backoffice)/backoffice/_shell/TopBar.tsx`
- `app/(backoffice)/backoffice/domains/page.tsx`

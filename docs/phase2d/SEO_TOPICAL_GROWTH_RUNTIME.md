# SEO — topical growth / content ops (2D2)

---

## 1. Temaer (Lunchportalen)

2D2 legger inn **hurtigsøk-knapper** for typiske klynger:

- lunsj  
- kontorlunsj  
- lunsjtid  
- firmalunsj  
- catering  
- bedrift  

Disse setter søkestreng `q` og kaller `GET /api/backoffice/content/pages?q=…` — **samme** datakilde som resten av CMS.

---

## 2. Prinsipper

- **Innholdsplan:** manuell — ingen autogenererte sider uten review.
- **Sideutkast:** opprettes fortsatt via innholdsredigerer / eksisterende flyter.
- **AI-forslag:** kun via `seo-intelligence` + eksisterende content-AI der det allerede finnes.
- **Taksonomi:** bruker **eksisterende** tre/slug (`content_pages`) — ingen ny taksonomi-tabell i 2D2.

---

## 3. Autoritet

- Topical authority bygges gjennom **kvalitet på sider** og **konsistent metadata** — ikke gjennom skjulte bulk-endringer.

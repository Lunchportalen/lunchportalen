-- Idempotent seed: published `home` page + nb/prod variant body for public getContentBySlug('home').
-- Authoritative body column: content_page_variants.body (content_pages has no body JSON column).
-- Block types match lib/public/blocks/renderBlock.tsx (hero, richText, cta, image).

WITH upsert_page AS (
  INSERT INTO public.content_pages (
    title,
    slug,
    status,
    tree_root_key,
    tree_sort_order,
    page_key,
    updated_at
  )
  VALUES (
    'Lunchportalen Home',
    'home',
    'published',
    'home',
    0,
    'home',
    now()
  )
  ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    status = EXCLUDED.status,
    tree_root_key = COALESCE(public.content_pages.tree_root_key, EXCLUDED.tree_root_key),
    tree_sort_order = COALESCE(public.content_pages.tree_sort_order, EXCLUDED.tree_sort_order),
    page_key = COALESCE(NULLIF(public.content_pages.page_key, ''), EXCLUDED.page_key),
    updated_at = now()
  RETURNING id
)
INSERT INTO public.content_page_variants (
  page_id,
  locale,
  environment,
  body,
  updated_at
)
SELECT
  upsert_page.id,
  'nb',
  'prod',
  $cms_home_body${"version":1,"meta":{"surface":"marketing_home","note":"Blocks use only public renderBlock types; layout differs from legacy static homepage until dedicated block renderers exist."},"blocks":[{"id":"home-hero","type":"hero","data":{"title":"Firmalunsj med kontroll.\nIngen unntak.","subtitle":"Én sannhetskilde for lunsjlevering, avtaler og historikk.","ctaLabel":"Registrer firma","ctaHref":"/registrering"}},{"id":"home-hero-secondary","type":"cta","data":{"title":"","body":"","buttonLabel":"Se hvordan det fungerer","href":"/hvordan"}},{"id":"home-why-head","type":"richText","data":{"heading":"Betaler dere for lunsj som ikke blir spist?","body":"Tradisjonelle løsninger gir matsvinn og uforutsigbarhet.\n\nMindre matsvinn\nAvbestilling før kl. 08:00 gir presis produksjon.\n\nMindre administrasjon\nAnsatte håndterer alt selv.\n\nMer forutsigbarhet\nIngen unntak gir kontroll."}},{"id":"home-why-cta-reg","type":"cta","data":{"title":"","body":"","buttonLabel":"Registrer firma","href":"/registrering"}},{"id":"home-why-cta-how","type":"cta","data":{"title":"","body":"","buttonLabel":"Se hvordan det fungerer","href":"/hvordan"}},{"id":"home-how-head","type":"richText","data":{"heading":"Slik fungerer det","body":""}},{"id":"home-how-1","type":"richText","data":{"heading":"1. Registrer firma","body":"Start med onboarding."}},{"id":"home-how-1-img","type":"image","data":{"src":"/matbilder/MelhusCatering-Lunsj-1017985.jpg","alt":"Firmalunsj til ansatte – levert til kontor"}},{"id":"home-how-2","type":"richText","data":{"heading":"2. Admin setter avtale","body":"Velg nivå og dager."}},{"id":"home-how-2-img","type":"image","data":{"src":"/matbilder/MelhusCatering-Lunsj-1018001.jpg","alt":"Variert firmalunsj – lunchordning for firma"}},{"id":"home-how-3","type":"richText","data":{"heading":"3. Ansatte bestiller","body":"Selvbetjening med cut-off."}},{"id":"home-how-3-img","type":"image","data":{"src":"/matbilder/MelhusCatering-Lunsj-1018019.jpg","alt":"Bestillingssystem for lunsj – digital lunsjplattform"}},{"id":"home-pricing","type":"richText","data":{"heading":"To nivå – tydelig avtale","body":"Basis — 90 kr / kuvert\n• Selvbetjening\n• Cut-off 08:00\n• Forutsigbar drift\n\nLuxus (featured) — 130 kr / kuvert\n• Mer variasjon\n• Høy verdi\n• Kontrollert flyt"}},{"id":"home-local-head","type":"richText","data":{"heading":"Lokalt og nasjonalt","body":""}},{"id":"home-local-oslo","type":"image","data":{"src":"/matbilder/MelhusCatering-Lunsj-1018047.jpg","alt":"Oslo","caption":"Oslo"}},{"id":"home-local-trondheim","type":"image","data":{"src":"/matbilder/MelhusCatering-Lunsj-1018059.jpg","alt":"Trondheim","caption":"Trondheim"}},{"id":"home-local-bergen","type":"image","data":{"src":"/matbilder/MelhusCatering-Lunsj-1018064.jpg","alt":"Bergen","caption":"Bergen"}},{"id":"home-final","type":"cta","data":{"title":"Klar for firmalunsj med kontroll?","body":"Registrer firma og få full oversikt.","buttonLabel":"Registrer firma","href":"/registrering"}},{"id":"home-final-secondary","type":"cta","data":{"title":"","body":"","buttonLabel":"Les hvordan det fungerer","href":"/hvordan"}}]}$cms_home_body$::jsonb,
  now()
FROM upsert_page
ON CONFLICT (page_id, locale, environment) DO UPDATE SET
  body = EXCLUDED.body,
  updated_at = now();

-- Seed canonical allergen and dietary tag reference data.
-- Idempotent: both tables have UNIQUE (code) constraints in live DB.

INSERT INTO public.allergens (code, name, sort_order) VALUES
  ('gluten', 'Gluten', 1),
  ('skalldyr', 'Skalldyr', 2),
  ('egg', 'Egg', 3),
  ('fisk', 'Fisk', 4),
  ('jordnoetter', 'Jordnøtter', 5),
  ('soya', 'Soya', 6),
  ('melk', 'Melk/Laktose', 7),
  ('noetter', 'Nøtter', 8),
  ('selleri', 'Selleri', 9),
  ('sennep', 'Sennep', 10),
  ('sesamfroe', 'Sesamfrø', 11),
  ('svoveldioksid', 'Svoveldioksid/Sulfitter', 12),
  ('lupin', 'Lupin', 13),
  ('blaaskoell', 'Blåskjell/Muslinger', 14)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.dietary_tags (code, name, sort_order) VALUES
  ('vegetar', 'Vegetar', 1),
  ('vegansk', 'Vegansk', 2),
  ('glutenfri', 'Glutenfri', 3),
  ('laktosefri', 'Laktosefri', 4),
  ('halal', 'Halal', 5),
  ('kosher', 'Kosher', 6),
  ('noett-fri', 'Nøttfri', 7),
  ('lavkalori', 'Lavkalori', 8),
  ('keto', 'Keto', 9),
  ('raw', 'Raw/Rå kost', 10)
ON CONFLICT (code) DO NOTHING;

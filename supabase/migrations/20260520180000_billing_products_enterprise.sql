-- MP5: Re-introduce ENTERPRISE as full 3rd billing tier (distinct from LUXUS).

ALTER TABLE public.billing_products
    DROP CONSTRAINT IF EXISTS billing_products_tier_check;

ALTER TABLE public.billing_products
    ADD CONSTRAINT billing_products_tier_check
    CHECK (tier IN ('BASIS', 'LUXUS', 'ENTERPRISE'));

INSERT INTO public.billing_products (tier, product_name, tax_code_id)
VALUES ('ENTERPRISE', 'Lunsj Enterprise', 'MVA_15')
ON CONFLICT (tier) DO UPDATE SET
    product_name = EXCLUDED.product_name,
    tax_code_id = EXCLUDED.tax_code_id,
    updated_at = now();

DO $$
DECLARE v_count int;
BEGIN
    SELECT count(*) INTO v_count FROM public.billing_products;
    IF v_count < 3 THEN
        RAISE EXCEPTION 'Expected 3 billing_products, got %', v_count;
    END IF;
END $$;

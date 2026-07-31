-- Ensure capacity release when an order becomes CANCELLED even if item-delete
-- ordering races with SET retry (delete+insert) leave a dangling RESERVE.

CREATE OR REPLACE FUNCTION public.tg_orders_capacity_release_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'CANCELLED'::public.order_status THEN
    PERFORM public.lp_capacity_release(NEW.id, NEW.user_id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_capacity_release_on_cancel ON public.orders;
CREATE TRIGGER trg_orders_capacity_release_on_cancel
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_orders_capacity_release_on_cancel();

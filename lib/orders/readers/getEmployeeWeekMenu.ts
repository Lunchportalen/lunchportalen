/**
 * Supabase column list for menu_service_day_items when building employee-facing payloads.
 * (Week UI today is CMS-driven; this is the canonical string when reading from Postgres.)
 */
import { pickMenuItemColumns } from "@/lib/orders/projection";

export const employeeMenuServiceDayItemSelect = (): string => pickMenuItemColumns(false);

import { pickMenuItemColumns } from "@/lib/orders/projection";

export const adminMenuServiceDayItemSelect = (): string => pickMenuItemColumns(true);

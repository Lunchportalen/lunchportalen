import type { ComponentType, ReactNode } from "react";

import BackofficeLayout from "@/components/layout/BackofficeLayout";
import CompanyLayout from "@/components/layout/CompanyLayout";
import DriverLayout from "@/components/layout/DriverLayout";
import EmployeeLayout from "@/components/layout/EmployeeLayout";
import KitchenLayout from "@/components/layout/KitchenLayout";
import PublicLayout from "@/components/layout/PublicLayout";
import SuperadminLayout from "@/components/layout/SuperadminLayout";

import type { LayoutType } from "./types";

type LayoutComponent = ComponentType<{ children: ReactNode }>;

export const layoutRegistry: Record<LayoutType, LayoutComponent> = {
  public: PublicLayout,
  backoffice: BackofficeLayout,
  superadmin: SuperadminLayout,
  company: CompanyLayout,
  employee: EmployeeLayout,
  kitchen: KitchenLayout,
  driver: DriverLayout,
};

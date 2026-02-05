// lib/system/types.ts
export type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

export type SystemSectionId =
  | "how-it-works"
  | "roles"
  | "ordering-model"
  | "commercial-model"
  | "security";

export type Visibility = {
  roles?: Role[]; // hvis tom/undefined => alle roller
};

export type DocBlock = {
  title: string;
  body: string[]; // hvert avsnitt
  visibility?: Visibility;
};

export type SystemSection = {
  id: SystemSectionId;
  title: string;
  subtitle?: string;
  blocks: DocBlock[];
};

import "server-only";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiOk<T> = {
  ok: true;
  rid: string;
  data: T;
};

export type ApiErr = {
  ok: false;
  rid: string;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiResult<T> = ApiOk<T> | ApiErr;

export type Role = "superadmin" | "company_admin" | "employee" | "kitchen" | "driver";
export type Scope = {
  rid: string;
  userId: string;
  role: Role;
  companyId: string | null;
  locationId: string | null;
};

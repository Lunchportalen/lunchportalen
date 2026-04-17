import { describe, expect, it, afterEach } from "vitest";
import {
  LOCAL_PROVIDER_CMS_AI_ATTRIBUTION_COMPANY_ID,
  normalizeSuggestToolId,
  resolveCmsAiTenantCompanyId,
} from "@/lib/ai/cmsAiTenant";

describe("cmsAiTenant", () => {
  const prevCms = process.env.CMS_AI_DEFAULT_COMPANY_ID;
  const prevLp = process.env.LP_CMS_AI_DEFAULT_COMPANY_ID;
  const prevMode = process.env.LP_CMS_RUNTIME_MODE;

  afterEach(() => {
    if (prevCms === undefined) delete process.env.CMS_AI_DEFAULT_COMPANY_ID;
    else process.env.CMS_AI_DEFAULT_COMPANY_ID = prevCms;
    if (prevLp === undefined) delete process.env.LP_CMS_AI_DEFAULT_COMPANY_ID;
    else process.env.LP_CMS_AI_DEFAULT_COMPANY_ID = prevLp;
    if (prevMode === undefined) delete process.env.LP_CMS_RUNTIME_MODE;
    else process.env.LP_CMS_RUNTIME_MODE = prevMode;
  });

  it("normalizeSuggestToolId maps improve_page to content.maintain.page", () => {
    expect(normalizeSuggestToolId("improve_page")).toBe("content.maintain.page");
    expect(normalizeSuggestToolId("Improve_Page")).toBe("content.maintain.page");
    expect(normalizeSuggestToolId("improvePage")).toBe("content.maintain.page");
    expect(normalizeSuggestToolId("content.maintain.page")).toBe("content.maintain.page");
  });

  it("resolveCmsAiTenantCompanyId prefers scope then env", () => {
    delete process.env.LP_CMS_AI_DEFAULT_COMPANY_ID;
    process.env.CMS_AI_DEFAULT_COMPANY_ID = "";
    expect(resolveCmsAiTenantCompanyId("  uuid-1  ")).toBe("uuid-1");
    process.env.CMS_AI_DEFAULT_COMPANY_ID = "env-co";
    expect(resolveCmsAiTenantCompanyId(null)).toBe("env-co");
  });

  it("resolveCmsAiTenantCompanyId uses platform attribution in remote_backend when env unset", () => {
    delete process.env.LP_CMS_AI_DEFAULT_COMPANY_ID;
    delete process.env.CMS_AI_DEFAULT_COMPANY_ID;
    process.env.LP_CMS_RUNTIME_MODE = "remote_backend";
    expect(resolveCmsAiTenantCompanyId(null)).toBe(LOCAL_PROVIDER_CMS_AI_ATTRIBUTION_COMPANY_ID);
  });
});

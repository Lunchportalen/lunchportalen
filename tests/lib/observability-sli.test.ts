// tests/lib/observability-sli.test.ts
// Deterministic tests for SLI calculators (no fake metrics).

// @ts-nocheck

import { describe, test, expect } from "vitest";
import {
  computeSliSystemHealth,
  computeSliCronCritical,
  computeSliCronOutbox,
  computeSliOrderWrite,
  computeSliAuth,
  computeSliContentPublish,
} from "@/lib/observability/sli";

function makeAdmin(mockTableHandlers: Record<string, any>) {
  return {
    from(table: string) {
      const handler = mockTableHandlers[table];
      if (!handler) {
        return {
          select: () => ({ data: [], error: null }),
          gte: () => ({ data: [], error: null }),
          in: () => ({ data: [], error: null }),
          eq: () => ({ data: [], error: null }),
        };
      }
      return handler;
    },
  };
}

describe("observability SLI calculators", () => {
  test("system_health: ok when all snapshots are normal", async () => {
    const admin = makeAdmin({
      system_health_snapshots: {
        select: () => ({
          gte: () =>
            Promise.resolve({
              data: [
                { ts: "2026-03-12T10:00:00Z", status: "normal" },
                { ts: "2026-03-12T10:05:00Z", status: "normal" },
              ],
              error: null,
            }),
        }),
      },
    });

    const sli = await computeSliSystemHealth(admin as any, 60);
    expect(sli.status).toBe("ok");
    expect(sli.good).toBe(2);
    expect(sli.total).toBe(2);
    expect(sli.ratePercent).toBe(100);
    expect(sli.windowMinutes).toBe(60);
  });

  test("system_health: unknown when no snapshots", async () => {
    const admin = makeAdmin({
      system_health_snapshots: {
        select: () => ({
          gte: () => Promise.resolve({ data: [], error: null }),
        }),
      },
    });

    const sli = await computeSliSystemHealth(admin as any, 60);
    expect(sli.status).toBe("unknown");
    expect(sli.ratePercent).toBeNull();
  });

  test("cron_critical: rate is based on ok status", async () => {
    const admin = makeAdmin({
      cron_runs: {
        select: () => ({
          gte: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  { job: "forecast", status: "ok" },
                  { job: "forecast", status: "error" },
                ],
                error: null,
              }),
          }),
        }),
      },
    });

    const sli = await computeSliCronCritical(admin as any, 1440);
    expect(sli.total).toBe(2);
    expect(sli.good).toBe(1);
    expect(sli.ratePercent).toBeCloseTo(50);
  });

  test("cron_outbox: unknown when no cron_runs rows", async () => {
    const admin = makeAdmin({
      cron_runs: {
        select: () => ({
          gte: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      },
    });

    const sli = await computeSliCronOutbox(admin as any, 1440);
    expect(sli.status).toBe("unknown");
    expect(sli.ratePercent).toBeNull();
  });

  test("order_write: ok when no ORDER incidents", async () => {
    const admin = makeAdmin({
      system_incidents: {
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      },
    });

    const sli = await computeSliOrderWrite(admin as any);
    expect(sli.status).toBe("ok");
    expect(sli.ratePercent).toBe(100);
  });

  test("order_write: breach when there are open ORDER incidents", async () => {
    const admin = makeAdmin({
      system_incidents: {
        select: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: "i1", type: "ORDER", status: "open" }],
                error: null,
              }),
          }),
        }),
      },
    });

    const sli = await computeSliOrderWrite(admin as any);
    expect(sli.status).toBe("breach");
    expect(sli.evidence.open_order_incidents).toBe(1);
  });

  test("auth_protected_route: breach when there are open AUTH incidents", async () => {
    const admin = makeAdmin({
      system_incidents: {
        select: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: "a1", type: "AUTH", status: "open" }],
                error: null,
              }),
          }),
        }),
      },
    });

    const sli = await computeSliAuth(admin as any);
    expect(sli.status).toBe("breach");
    expect(sli.evidence.open_auth_incidents).toBe(1);
  });

  test("content_publish: warn for single SANITY/INTEGRATION incident", async () => {
    const admin = makeAdmin({
      system_incidents: {
        select: () => ({
          in: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ id: "c1", type: "SANITY", status: "open" }],
                error: null,
              }),
          }),
        }),
      },
    });

    const sli = await computeSliContentPublish(admin as any);
    expect(sli.status).toBe("warn");
  });

  test("content_publish: breach for 2+ SANITY/INTEGRATION incidents", async () => {
    const admin = makeAdmin({
      system_incidents: {
        select: () => ({
          in: () => ({
            eq: () =>
              Promise.resolve({
                data: [
                  { id: "c1", type: "SANITY", status: "open" },
                  { id: "c2", type: "INTEGRATION", status: "open" },
                ],
                error: null,
              }),
          }),
        }),
      },
    });

    const sli = await computeSliContentPublish(admin as any);
    expect(sli.status).toBe("breach");
  });
});


export type StepLogEntry = {
  name: string;
  success: boolean;
  ms: number;
  detail?: string;
  at: string;
};

const entries: StepLogEntry[] = [];

const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

export function logStep(name: string, success: boolean, details?: string) {
  const label = success ? `${c.green}[PASS]${c.reset}` : `${c.red}[FAIL]${c.reset}`;
  const tail = details ? ` ${c.dim}→ ${details}${c.reset}` : "";
  // eslint-disable-next-line no-console
  console.log(`${label} ${name}${tail}`);
}

export function logStepTimed(name: string, fn: () => Promise<void>): Promise<void> {
  const t0 = Date.now();
  return fn()
    .then(() => {
      const ms = Date.now() - t0;
      entries.push({ name, success: true, ms, at: new Date().toISOString() });
      logStep(name, true, `${ms}ms`);
    })
    .catch((e: unknown) => {
      const ms = Date.now() - t0;
      const msg = e instanceof Error ? e.message : String(e);
      entries.push({ name, success: false, ms, detail: msg, at: new Date().toISOString() });
      logStep(name, false, msg);
      throw e;
    });
}

export function getStructuredLog(): { steps: StepLogEntry[]; passed: number; failed: number } {
  const passed = entries.filter((e) => e.success).length;
  const failed = entries.filter((e) => !e.success).length;
  return { steps: [...entries], passed, failed };
}

export function printStructuredSummary() {
  const s = getStructuredLog();
  // eslint-disable-next-line no-console
  console.log(`${c.dim}--- structured (JSON) ---${c.reset}`);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: s.failed === 0, ...s }, null, 2));
}

export function resetLog() {
  entries.length = 0;
}

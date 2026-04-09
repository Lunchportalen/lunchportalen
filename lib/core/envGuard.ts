import "server-only";

/**
 * Fail-closed env-lesing. Kall kun der nøkkel faktisk kreves (ikke ved modul-import — unngår CI/dev-brudd).
 */
export function requireEnv(key: string): string {
  const val = process.env[key];
  if (val == null || String(val).trim() === "") {
    const err = {
      code: "ENV_MISSING",
      message: key,
      source: "env",
      severity: "high" as const,
    };
    console.error("[ENV_MISSING]", key);
    throw err;
  }
  return String(val);
}

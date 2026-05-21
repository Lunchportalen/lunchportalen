import "server-only";

/** Provider-facing Tripletex env (default prod). Override with TRIPLETEX_PROVIDER_ENV=test. */
export function resolveTripletexProviderEnv(): "test" | "prod" {
  const raw = String(process.env.TRIPLETEX_PROVIDER_ENV ?? "prod").trim().toLowerCase();
  return raw === "test" ? "test" : "prod";
}

import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType> | null = null;

function redisUrl(): string | null {
  const u = String(process.env.REDIS_URL ?? "").trim();
  return u || null;
}

/**
 * Lazy singleton Redis client (Node server / workers only — not Edge).
 * Fail-closed: returns null if REDIS_URL is unset or connection fails.
 */
export async function getRedis(): Promise<RedisClientType | null> {
  const url = redisUrl();
  if (!url) return null;

  if (client?.isOpen) return client;

  if (connectPromise) {
    try {
      return await connectPromise;
    } catch {
      return null;
    }
  }

  connectPromise = (async () => {
    const c = createClient({ url }) as RedisClientType;
    c.on("error", (err) => {
      console.error("[redis]", err instanceof Error ? err.message : String(err));
    });
    await c.connect();
    client = c;
    return c;
  })();

  try {
    return await connectPromise;
  } catch (e) {
    console.error("[redis_connect_failed]", e instanceof Error ? e.message : String(e));
    client = null;
    connectPromise = null;
    return null;
  }
}

export function isRedisConfigured(): boolean {
  return redisUrl() != null;
}

export type RedisFetchResult =
  | { ok: true; data: unknown }
  | { ok: false; code: string };

/**
 * Lavnivå Redis-kommando (LPUSH, RPOP, PUBLISH, …). Fail-closed når Redis mangler.
 */
export async function redisFetch(command: string, args: string[]): Promise<RedisFetchResult> {
  const c = await getRedis();
  if (!c) {
    return { ok: false, code: "REDIS_UNAVAILABLE" };
  }
  try {
    const argv = [command, ...args];
    const data = await c.sendCommand(argv);
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[redisFetch]", command, msg);
    return { ok: false, code: "REDIS_COMMAND_FAILED" };
  }
}

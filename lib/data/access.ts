import "server-only";

export async function readData<T>(fn: () => Promise<T>): Promise<T> {
  console.log("[DATA_READ]", { ts: Date.now() });
  return fn();
}

export async function writeData<T>(fn: () => Promise<T>): Promise<T> {
  console.log("[DATA_WRITE]", { ts: Date.now() });
  return fn();
}

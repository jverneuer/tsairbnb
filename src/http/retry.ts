import { getConfig } from "../config/load.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Minimal retry with exponential backoff + jitter. No external dep.
 * 403 is treated as a hard block (caller surfaces a "block" event) — NOT retried,
 * because hammering a flagged IP makes it worse.
 */
export async function withRetry<T>(
  fn: () => Promise<{ status: number; value: T }>,
  opts: { retries?: number; endpoint: string } = { endpoint: "unknown" },
): Promise<{ status: number; value: T }> {
  const { retries = 3 } = opts;
  let attempt = 0;
  let backoff = 500 + Math.floor(Math.random() * 300); // jitter
  for (;;) {
    try {
      const { status, value } = await fn();
      if (!RETRYABLE.has(status)) return { status, value };
      if (attempt >= retries) return { status, value };
    } catch (e) {
      if (attempt >= retries) throw e;
    }
    await sleep(backoff);
    backoff = Math.min(backoff * 2, getConfig().timeoutMs);
    attempt++;
  }
}

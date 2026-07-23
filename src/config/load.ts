import { Config } from "./schema.js";
import { DEFAULT_CONFIG } from "./defaults.js";

/**
 * Live config holder. Holds the validated config and supports hot-reload.
 * In Lambda: bootstrapped from SSM (/tsairbnb/endpoint-config) with a local fallback.
 * In dev/tests: defaults.
 */

let current: Config = DEFAULT_CONFIG;

export function getConfig(): Config {
  return current;
}

export function setConfig(c: Config): void {
  current = c;
}

/** Validate + set. Throws ZodError on bad input — call sites decide to swallow or surface. */
export function loadConfig(input: unknown): Config {
  const parsed = Config.parse(input);
  setConfig(parsed);
  return parsed;
}

/**
 * Pick a deterministic-by-day UA from the pool. Deterministic so CloudFront cache hits
 * stay consistent within a day; rotation across days avoids static single-UA fingerprinting.
 */
export function rotateUserAgent(): string {
  const pool = current.userAgents;
  if (pool.length === 1) return pool[0]!;
  // Deterministic per day (Date.now forbidden in some contexts; use env override in tests).
  const seed = Number(process.env.TSAIRBNB_UA_SEED ?? Math.floor(Date.now() / 86_400_000));
  return pool[seed % pool.length]!;
}

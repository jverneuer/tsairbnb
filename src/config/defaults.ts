import type { Config } from "./schema.js";

/** A curated pool of recent Chrome desktop UAs. Rotate to avoid single-UA fingerprinting. */
export const DEFAULT_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
] as const;

/** The config shipped to SSM and used as the dev fallback. */
export const DEFAULT_CONFIG = {
  userAgents: [...DEFAULT_USER_AGENTS],
  acceptLanguage: "en-US,en;q=0.9",
  currency: "USD",
  locale: "en",
  proxies: [],
  hashOverrides: {},
  tlsProfile: "chrome124",
  timeoutMs: 30_000,
  maxPages: 50,
  itemsPerGrid: 50,
} satisfies Config;

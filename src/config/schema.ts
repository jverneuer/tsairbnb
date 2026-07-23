import { z } from "zod";

/**
 * Runtime config schema. Validated at load. Lives in SSM in prod, a local file in dev.
 * Edit user agents / locale / hash overrides here WITHOUT a redeploy.
 */
export const Config = z.object({
  /** Rotating pool of User-Agent strings. One is picked per request. */
  userAgents: z.array(z.string()).min(1),
  /** Accept-Language value, e.g. "en-US,en;q=0.9". */
  acceptLanguage: z.string().default("en-US,en;q=0.9"),
  /** Default currency code. */
  currency: z.string().default("USD"),
  /** Default locale code. */
  locale: z.string().default("en"),
  /** HTTP proxy URLs to route requests through (empty = direct). */
  proxies: z.array(z.string()).default([]),
  /** Override persisted-query hashes when Airbnb rotates them. Keyed by operation name. */
  hashOverrides: z
    .record(z.string(), z.string().regex(/^[0-9a-f]{64}$/))
    .default({}),
  /** curl-impersonate target profile. */
  tlsProfile: z.enum(["chrome120", "chrome124", "chrome131"]).default("chrome124"),
  /** Per-request timeout (ms). */
  timeoutMs: z.number().int().positive().default(30_000),
  /** Max pagination pages on cursor/offset endpoints. Safety cap. */
  maxPages: z.number().int().positive().default(50),
  /** Search page size (pyairbnb's itemsPerGrid). Default 50 — do NOT raise without ToS review. */
  itemsPerGrid: z.number().int().positive().default(50),
});

export type Config = z.infer<typeof Config>;

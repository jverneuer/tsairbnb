import { fetchStaysSearchHash } from "../registry/hashes-resolver.js";
import type { Envelope } from "../types/envelope.js";

/**
 * fetch-stays-search-hash — dynamic StaysSearch persisted-query hash resolver.
 * Ports pyairbnb's search.py::fetch_stays_search_hash. Scrapes the webpack bundle manifest
 * from the homepage, probes neighboring JS chunks. The most fragile endpoint — Airbnb rotates
 * this hash and the bundle path regex drifts. Falls back to the static default on failure.
 */

export type FetchHashMode =
  | { mode: "live"; domain?: string }
  | { mode: "reprocess"; raw: unknown };

export async function fetchStaysSearchHashEndpoint(opts: FetchHashMode): Promise<Envelope<{ hash: string; source: "dynamic" | "static" }>> {
  if (opts.mode === "reprocess") {
    const hash = typeof opts.raw === "string" ? opts.raw : (opts.raw as any)?.data?.niobeClientData?.[0]?.[1]?.operationId;
    if (!hash) return { ok: false, error: "no hash in raw", code: "parse" };
    return { ok: true, data: { hash, source: "dynamic" }, raw: opts.raw, meta: { fetchedAt: null, endpoint: "fetch-stays-search-hash", durationMs: 0, parserVersion: "passthrough", warnings: [], mode: "reprocess" } };
  }

  const t0 = Date.now();
  try {
    const hash = await fetchStaysSearchHash(opts.domain);
    return { ok: true, data: { hash, source: "dynamic" }, raw: null, meta: { fetchedAt: new Date().toISOString(), endpoint: "fetch-stays-search-hash", durationMs: Date.now() - t0, parserVersion: "webpack-scrape", warnings: [], mode: "live" } };
  } catch (e) {
    // Fall back to the static default from the registry — matches pyairbnb's behavior.
    const { PERSISTED_QUERIES } = await import("../registry/hashes.js");
    return { ok: true, data: { hash: PERSISTED_QUERIES.StaysSearch, source: "static" }, raw: null, meta: { fetchedAt: new Date().toISOString(), endpoint: "fetch-stays-search-hash", durationMs: Date.now() - t0, parserVersion: "static-fallback", warnings: [`dynamic resolve failed: ${(e as Error).message}; using static default`], mode: "live" } };
  }
}

import { getClient } from "../http/curl-impersonate.js";
import { graphqlHeaders } from "../http/headers.js";
import { emit } from "../telemetry.js";
import { getConfig } from "../config/load.js";
import type { Envelope } from "../types/envelope.js";
import { baseUrl, extractDomain } from "../lib/domain.js";

/**
 * get-markets — REST v2 user_markets. Ports pyairbnb's search.py.
 * Returns the full markets array; callers typically take [0].satori_parameters + country_code.
 */

export type GetMarketsMode =
  | { mode: "live"; apiKey: string; language?: string; domain?: string }
  | { mode: "reprocess"; raw: unknown };

export async function getMarkets(opts: GetMarketsMode): Promise<Envelope<unknown[]>> {
  if (opts.mode === "reprocess") {
    const raw = opts.raw;
    const terms = (raw as any)?.user_markets ?? (raw as any)?.data?.user_markets ?? raw;
    return { ok: true, data: Array.isArray(terms) ? terms : [terms], raw, meta: { fetchedAt: null, endpoint: "get-markets", durationMs: 0, parserVersion: "passthrough", warnings: [], mode: "reprocess" } };
  }

  const locale = opts.language ?? getConfig().locale;
  const currency = getConfig().currency;
  const url = `${baseUrl(opts.domain)}/api/v2/user_markets?locale=${locale}&currency=${currency}&language=en`;
  const t0 = Date.now();
  const res = await getClient().request({ url, headers: graphqlHeaders(opts.apiKey) });
  const respondedDomain = res.effectiveUrl ? extractDomain(res.effectiveUrl) : undefined;
  emit({ t: "http", endpoint: "get-markets", status: res.status, durationMs: Date.now() - t0 });
  if (res.status === 403) { emit({ t: "block", endpoint: "get-markets", reason: "http-403" }); return { ok: false, error: "blocked: 403", code: "block" }; }
  if (res.status !== 200) return { ok: false, error: `http ${res.status}`, code: `http-${res.status}` };

  let raw: unknown;
  try { raw = JSON.parse(res.body); } catch { return { ok: false, error: "not JSON", code: "parse" }; }
  const terms = (raw as any)?.user_markets ?? (raw as any)?.data?.user_markets ?? raw;
  return { ok: true, data: Array.isArray(terms) ? terms : [terms], raw, meta: { fetchedAt: new Date().toISOString(), endpoint: "get-markets", durationMs: Date.now() - t0, parserVersion: "passthrough", warnings: [], mode: "live", ...(respondedDomain !== undefined ? { respondedDomain } : {}) } };
}

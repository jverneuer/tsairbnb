import { getClient } from "../http/curl-impersonate.js";
import { graphqlHeaders } from "../http/headers.js";
import { emit } from "../telemetry.js";
import { getConfig } from "../config/load.js";
import type { Envelope } from "../types/envelope.js";
import { baseUrl, extractDomain } from "../lib/domain.js";

/**
 * get-places-ids — REST v2 autocompletes-personalized. Ports pyairbnb's search.py.
 * Returns autocomplete_terms; callers take [0].location.google_place_id + location_name.
 */

export type GetPlacesMode =
  | { mode: "live"; country: string; locationName: string; apiKey: string; configToken: string; language?: string; domain?: string }
  | { mode: "reprocess"; raw: unknown };

export async function getPlacesIds(opts: GetPlacesMode): Promise<Envelope<unknown[]>> {
  if (opts.mode === "reprocess") {
    const raw = opts.raw;
    const terms = (raw as any)?.autocomplete_terms ?? (raw as any)?.data?.autocomplete_terms ?? raw;
    return { ok: true, data: Array.isArray(terms) ? terms : [terms], raw, meta: { fetchedAt: null, endpoint: "get-places-ids", durationMs: 0, parserVersion: "passthrough", warnings: [], mode: "reprocess" } };
  }

  const locale = opts.language ?? getConfig().locale;
  const currency = getConfig().currency;
  const qs = new URLSearchParams({
    currency, country: opts.country, key: opts.apiKey, language: "en", locale,
    num_results: "10", user_input: opts.locationName, api_version: "1.2.0",
    satori_config_token: opts.configToken, vertical_refinement: "experiences", region: "-1",
  });
  const url = `${baseUrl(opts.domain)}/api/v2/autocompletes-personalized?${qs}`;
  const t0 = Date.now();
  const res = await getClient().request({ url, headers: graphqlHeaders(opts.apiKey) });
  const respondedDomain = res.effectiveUrl ? extractDomain(res.effectiveUrl) : undefined;
  emit({ t: "http", endpoint: "get-places-ids", status: res.status, durationMs: Date.now() - t0 });
  if (res.status === 403) { emit({ t: "block", endpoint: "get-places-ids", reason: "http-403" }); return { ok: false, error: "blocked: 403", code: "block" }; }
  if (res.status !== 200) return { ok: false, error: `http ${res.status}`, code: `http-${res.status}` };

  let raw: unknown;
  try { raw = JSON.parse(res.body); } catch { return { ok: false, error: "not JSON", code: "parse" }; }
  const terms = (raw as any)?.autocomplete_terms ?? (raw as any)?.data?.autocomplete_terms ?? raw;
  return { ok: true, data: Array.isArray(terms) ? terms : [terms], raw, meta: { fetchedAt: new Date().toISOString(), endpoint: "get-places-ids", durationMs: Date.now() - t0, parserVersion: "passthrough", warnings: [], mode: "live", ...(respondedDomain !== undefined ? { respondedDomain } : {}) } };
}

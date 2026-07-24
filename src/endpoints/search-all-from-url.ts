import type { Envelope } from "../types/envelope.js";
import type { SearchHit } from "../types/domain.js";
import { searchAll, type SearchAllVariables } from "./search-all.js";

/**
 * search-all-from-url — parse an Airbnb /s/... URL into rawParams, then paginate.
 * Ports pyairbnb's start.py::search_all_from_url (via url_to_raw_params).
 * Minimal: forwards the URL through as a rawParams passthrough; the heavy lifting is searchAll.
 */

const SEARCH_PARAMS = ["check_in", "check_out", "ne_lat", "ne_lng", "sw_lat", "sw_lng", "zoom", "price_min", "price_max", "adults", "children", "infants"];

export type SearchFromUrlMode =
  | { mode: "live"; url: string; apiKey: string; currency?: string; language?: string; domain?: string }
  | { mode: "reprocess"; raw: unknown };

export async function searchAllFromUrl(opts: SearchFromUrlMode): Promise<Envelope<readonly SearchHit[]>> {
  if (opts.mode === "reprocess") {
    const { parseSearch } = await import("../parsers/search.js");
    const parsed = await parseSearch(opts.raw);
    if ("error" in parsed) return { ok: false, error: parsed.error, code: "no-strategy-matched", meta: { fetchedAt: null, endpoint: "search-all-from-url", durationMs: 0, parserVersion: "none", warnings: [], mode: "reprocess" } };
    return { ok: true, data: [...parsed.data.hits], raw: opts.raw, meta: { fetchedAt: null, endpoint: "search-all-from-url", durationMs: 0, parserVersion: parsed.parserVersion, warnings: parsed.warnings, mode: "reprocess" } };
  }

  const url = new URL(opts.url);
  const sp = url.searchParams;
  const variables: SearchAllVariables = {};
  const ci = sp.get("check_in"); if (ci) variables.checkIn = ci;
  const co = sp.get("check_out"); if (co) variables.checkOut = co;
  const neLat = num(sp.get("ne_lat")); if (neLat != null) variables.neLat = neLat;
  const neLong = num(sp.get("ne_lng")); if (neLong != null) variables.neLong = neLong;
  const swLat = num(sp.get("sw_lat")); if (swLat != null) variables.swLat = swLat;
  const swLong = num(sp.get("sw_lng")); if (swLong != null) variables.swLong = swLong;
  const zoom = num(sp.get("zoom")); if (zoom != null) variables.zoomValue = zoom;
  const pMin = num(sp.get("price_min")); if (pMin != null) variables.priceMin = pMin;
  const pMax = num(sp.get("price_max")); if (pMax != null) variables.priceMax = pMax;
  const adults = num(sp.get("adults")); if (adults != null) variables.adults = adults;
  const children = num(sp.get("children")); if (children != null) variables.children = children;
  const infants = num(sp.get("infants")); if (infants != null) variables.infants = infants;
  return searchAll({ mode: "live", apiKey: opts.apiKey, variables, ...(opts.currency !== undefined ? { currency: opts.currency } : {}), ...(opts.language !== undefined ? { language: opts.language } : {}), ...(opts.domain !== undefined ? { domain: opts.domain } : {}) });
}

function num(s: string | null) { return s == null ? undefined : Number(s); }

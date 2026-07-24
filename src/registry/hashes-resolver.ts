import { getClient } from "../http/curl-impersonate.js";
import { browserHeaders } from "../http/headers.js";

/**
 * Dynamic StaysSearch hash resolver — ports pyairbnb's fetch_stays_search_hash.
 * Airbnb rotates the StaysSearch persisted-query SHA periodically. We scrape the webpack
 * bundle manifest from the homepage, then probe neighboring JS chunks for the hash.
 *
 * This is the most fragile piece. The candidate-slice + multi-regex approach is deliberately
 * loose because the bundle path regex and chunk naming drift frequently.
 */

const HOMEPAGE = "https://www.airbnb.com/";

const BUNDLE_RE =
  /https:\/\/a0\.muscache\.com\/airbnb\/static\/packages\/web\/[^/]+\/frontend\/airmetro\/browser\/asyncRequire\.[^"']+\.js/g;

const MODULE_RE =
  /(?:common|[a-z]{2}(?:-[A-Za-z]{2,4})?)\/frontend\/stays-search\/routes\/StaysSearchRoute\/StaysSearchRoute\.prepare\.[^"']+\.js/g;

const JS_PATH_RE = /(?:common|[a-z]{2}(?:-[A-Za-z]{2,4})?)\/[^"'\\\s<>]+?\.js/g;

const HASH_PATTERNS = [
  /(?:name|operationName):"StaysSearch"[\s\S]{0,2000}?(?:operationId|sha256Hash):"([0-9a-f]{64})"/,
  /(?:operationId|sha256Hash):"([0-9a-f]{64})"[\s\S]{0,2000}?(?:name|operationName):"StaysSearch"/,
  /\/api\/v3\/StaysSearch\/([0-9a-f]{64})/,
  /StaysSearch\/([0-9a-f]{64})/,
];

export async function fetchStaysSearchHash(): Promise<string> {
  const client = getClient();

  // 1. Homepage → bundle manifest URL
  const home = await client.request({ url: HOMEPAGE, headers: browserHeaders() });
  const bundleMatch = home.body.match(BUNDLE_RE);
  if (!bundleMatch || bundleMatch.length === 0) {
    throw new Error("fetch-stays-search-hash: no bundle manifest URL on homepage");
  }
  const bundleUrl = bundleMatch[0]!;

  // 2. Bundle manifest → module path + all JS paths
  const bundle = await client.request({ url: bundleUrl, headers: browserHeaders() });
  const moduleMatch = bundle.body.match(MODULE_RE);
  // moduleMatch non-null ⟹ JS_PATH_RE (a superset) also matches — safe to non-null assert.
  const jsPaths: string[] = bundle.body.match(JS_PATH_RE)!;
  if (!moduleMatch || moduleMatch.length === 0) {
    throw new Error("fetch-stays-search-hash: no StaysSearchRoute module path in bundle");
  }
  const modulePath = moduleMatch[0]!;
  const moduleIdx = jsPaths.indexOf(modulePath);

  // 3. Candidate slice: module + up to 3 prior + 35 following siblings
  const start = Math.max(0, moduleIdx - 3);
  const end = moduleIdx + 36;
  const candidates = [modulePath, ...jsPaths.slice(start, end)];

  // 4. Probe each candidate chunk
  for (const candidate of candidates) {
    const url = `https://a0.muscache.com/airbnb/static/packages/web/${candidate}`;
    const chunk = await client.request({ url, headers: browserHeaders() });
    for (const re of HASH_PATTERNS) {
      const m = chunk.body.match(re);
      if (m?.[1]) return m[1];
    }
    // Fallback: if this is the exact module chunk and exactly one hash exists, take it.
    if (candidate === modulePath) {
      const all = chunk.body.match(/(?:operationId|sha256Hash):"([0-9a-f]{64})"/g);
      if (all && all.length === 1) {
        const m = all[0]!.match(/([0-9a-f]{64})/);
        /* istanbul ignore else: regex match always succeeds since all entries already matched the same pattern */
        if (m && m[1]) return m[1];
      }
    }
  }

  throw new Error("fetch-stays-search-hash: unable to extract StaysSearch operationId");
}

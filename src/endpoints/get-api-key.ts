import { getClient } from "../http/curl-impersonate.js";
import { browserHeaders } from "../http/headers.js";
import { emit } from "../telemetry.js";
import type { Envelope } from "../types/envelope.js";

/**
 * get-api-key — scrape the Airbnb homepage for the public API key used as X-Airbnb-Api-Key
 * on every GraphQL call. This is the "api_config":{"key":"..."} regex from pyairbnb's api.py.
 * The key is stable for a while but can rotate; refresh periodically.
 */

const HOMEPAGE = "https://www.airbnb.com/";
const API_KEY_RE = /"api_config":\{"key":"([^"]+)"/;

export type GetApiKeyMode =
  | { mode: "live" }
  | { mode: "reprocess"; raw: string };

export async function getApiKey(opts: GetApiKeyMode): Promise<Envelope<{ apiKey: string }>> {
  if (opts.mode === "reprocess") {
    const m = opts.raw.match(API_KEY_RE);
    if (!m?.[1]) return { ok: false, error: "no api_config.key in raw", code: "parse" };
    return { ok: true, data: { apiKey: m[1] }, raw: opts.raw, meta: metaBase("reprocess", "regex", []) };
  }

  const t0 = Date.now();
  const res = await getClient().request({ url: HOMEPAGE, headers: browserHeaders() });
  emit({ t: "http", endpoint: "get-api-key", status: res.status, durationMs: Date.now() - t0 });
  if (res.status !== 200) return { ok: false, error: `http ${res.status}`, code: `http-${res.status}` };

  const m = res.body.match(API_KEY_RE);
  if (!m?.[1]) return { ok: false, error: "no api_config.key on homepage", code: "parse", raw: res.body };
  return {
    ok: true,
    data: { apiKey: m[1] },
    raw: res.body,
    meta: metaBase("live", "regex", [], t0),
  };
}

function metaBase(mode: "live" | "reprocess", parserVersion: string, warnings: string[], t0 = 0) {
  return {
    fetchedAt: mode === "live" ? new Date().toISOString() : null,
    endpoint: "get-api-key",
    durationMs: t0 ? Date.now() - t0 : 0,
    parserVersion,
    warnings,
    mode,
  };
}

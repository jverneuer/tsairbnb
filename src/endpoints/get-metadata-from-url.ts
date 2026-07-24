import { getClient } from "../http/curl-impersonate.js";
import { browserHeaders } from "../http/headers.js";
import { emit } from "../telemetry.js";
import type { Envelope } from "../types/envelope.js";
import { extractDomain } from "../lib/domain.js";

/**
 * get-metadata-from-url — low-level listing-page scrape. Ports pyairbnb's parse.py:
 *   1. GET the listing page HTML
 *   2. Extract the #data-deferred-state-0 text (the niobe blob)
 *   3. Pull language + api_key out via regex
 *   4. JSON.parse, return niobeClientData[0][1] + price_input{ product_id, api_key, impression_id } + cookies
 *
 * This is the two-step price flow's first step: get-details calls this, then passes the
 * returned impression_id + cookies to get-price. See pyairbnb issue #55.
 */

const DEFERRED_STATE_RE = /<[^>]*id="data-deferred-state-0"[^>]*>([\s\S]*?)<\/[^>]*>/;
const LANGUAGE_RE = /"language":"([^"]+)"/;
const KEY_RE = /"key":"([^"]+)"/;
const IMPRESSION_RE = /"p3ImpressionId":"([^"]+)"/;
const PRODUCT_ID_RE = /"productId":"([^"]+)"/;

export interface Metadata {
  data: unknown;
  priceInput: { productId: string | null; apiKey: string | null; impressionId: string | null };
  cookies: Record<string, string>;
  language: string | null;
}

export type GetMetadataMode =
  | { mode: "live"; roomUrl: string; language?: string }
  | { mode: "reprocess"; raw: { html: string; cookies?: Record<string, string> } };

export async function getMetadataFromUrl(opts: GetMetadataMode): Promise<Envelope<Metadata>> {
  if (opts.mode === "reprocess") {
    return parseHtml(opts.raw.html, opts.raw.cookies ?? {}, "reprocess");
  }

  const t0 = Date.now();
  const res = await getClient().request({
    url: opts.roomUrl,
    headers: browserHeaders(opts.language ?? "en"),
  });
  const respondedDomain = res.effectiveUrl ? extractDomain(res.effectiveUrl) : undefined;
  emit({ t: "http", endpoint: "get-metadata-from-url", status: res.status, durationMs: Date.now() - t0 });
  if (res.status === 403) {
    emit({ t: "block", endpoint: "get-metadata-from-url", reason: "http-403" });
    return { ok: false, error: "blocked: 403", code: "block" };
  }
  if (res.status !== 200) return { ok: false, error: `http ${res.status}`, code: `http-${res.status}` };
  return parseHtml(res.body, res.cookies ?? {}, "live", t0, respondedDomain);
}

function parseHtml(html: string, cookies: Record<string, string>, mode: "live" | "reprocess", t0 = 0, respondedDomain?: string): Envelope<Metadata> {
  const warnings: string[] = [];
  const deferred = html.match(DEFERRED_STATE_RE)?.[1];
  if (!deferred) warnings.push("no #data-deferred-state-0 blob");

  const language = html.match(LANGUAGE_RE)?.[1] ?? null;
  const apiKey = html.match(KEY_RE)?.[1] ?? null;
  const impressionId = html.match(IMPRESSION_RE)?.[1] ?? null;
  const productId = html.match(PRODUCT_ID_RE)?.[1] ?? null;

  let data: unknown = null;
  if (deferred) {
    try {
      const cleaned = deferred.replace(/\s+/g, " ").trim();
      const parsed = JSON.parse(cleaned);
      data = parsed?.niobeClientData?.[0]?.[1] ?? parsed;
    } catch (e) {
      warnings.push(`niobe parse failed: ${(e as Error).message}`);
    }
  }

  return {
    ok: true,
    data: { data, priceInput: { productId, apiKey, impressionId }, cookies, language },
    raw: html,
    meta: {
      fetchedAt: mode === "live" ? new Date().toISOString() : null,
      endpoint: "get-metadata-from-url",
      durationMs: t0 ? Date.now() - t0 : 0,
      parserVersion: "deferred-state",
      warnings,
      mode,
      ...(respondedDomain !== undefined ? { respondedDomain } : {}),
    },
  };
}

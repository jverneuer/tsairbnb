import { emit } from "../telemetry.js";
import type { Envelope } from "../types/envelope.js";
import type { Listing } from "../types/domain.js";
import { getMetadataFromUrl } from "./get-metadata-from-url.js";
import { getReviews } from "./get-reviews.js";
import { getCalendar } from "./get-calendar.js";
import { getHostDetails } from "./get-host-details.js";
import { getPrice } from "./get-price.js";
import { path } from "../lib/get.js";

/**
 * get-details — the aggregator. Ports pyairbnb's start.py::get_details:
 *   1. scrape listing page (get-metadata-from-url)
 *   2. reviews + calendar + host_details
 *   3. price ONLY if both check_in AND check_out are provided (pyairbnb issue #55)
 *
 * Without dates you get details but no price — matching pyairbnb's documented behavior.
 */

export interface GetDetailsOpts {
  mode: "live" | "reprocess";
  roomUrl?: string;
  roomId?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  language?: string;
  raw?: unknown;
}

export async function getDetails(opts: GetDetailsOpts): Promise<Envelope<Listing & { reviews?: unknown; calendar?: unknown; host?: unknown; price?: unknown }>> {
  if (opts.mode === "reprocess") {
    const { parseListing } = await import("../parsers/listing.js");
    const parsed = await parseListing(opts.raw) as { data: Listing; parserVersion: string; warnings: string[] };
    return {
      ok: true,
      data: opts.raw as any,
      raw: opts.raw,
      meta: { fetchedAt: null, endpoint: "get-details", durationMs: 0, parserVersion: parsed.parserVersion, warnings: parsed.warnings, mode: "reprocess" },
    };
  }

  const roomUrl = opts.roomUrl ?? (opts.roomId ? `https://www.airbnb.com/rooms/${opts.roomId}` : undefined);
  if (!roomUrl) return { ok: false, error: "need roomUrl or roomId", code: "input" };

  const warnings: string[] = [];
  const t0 = Date.now();

  // 1. listing page scrape
  const meta = await getMetadataFromUrl({ mode: "live", roomUrl, language: opts.language ?? "" });
  if (!meta.ok) return meta as Envelope<any>;
  const apiKey = meta.data.priceInput.apiKey ?? scrapeApiKey(meta.raw as string);
  const impressionId = meta.data.priceInput.impressionId ?? null;
  const cookies = meta.data.cookies;

  // 2. parse the listing blob
  const { parseListing } = await import("../parsers/listing.js");
  const parsed = await parseListing(meta.data.data) as { data: Listing; parserVersion: string; warnings: string[] };
  warnings.push(...parsed.warnings);

  const data: any = { ...parsed.data };

  // 3. reviews + calendar + host_details (best-effort; failures become warnings)
  const [reviews, calendar, host] = await Promise.allSettled([
    apiKey ? getReviews({ mode: "live", roomUrl, language: opts.language ?? "", apiKey }) : Promise.resolve(null),
    apiKey && data.id ? getCalendar({ mode: "live", roomId: String(data.id), apiKey }) : Promise.resolve(null),
    apiKey && data.host?.id ? getHostDetails({ mode: "live", hostId: data.host.id, apiKey, language: opts.language ?? "" }) : Promise.resolve(null),
  ]);
  if (reviews.status === "fulfilled" && reviews.value) data.reviews = reviews.value;
  else if (reviews.status === "rejected") warnings.push(`reviews: ${reviews.reason}`);
  if (calendar.status === "fulfilled" && calendar.value) data.calendar = calendar.value;
  if (host.status === "fulfilled" && host.value?.ok) data.host = { ...data.host, ...host.value.data };

  // 4. price only when both dates present
  if (opts.checkIn && opts.checkOut && apiKey && impressionId && data.id) {
    const price = await getPrice({
      mode: "live",
      roomId: String(data.id),
      checkIn: opts.checkIn,
      checkOut: opts.checkOut,
      adults: opts.adults ?? 1,
      apiKey,
      impressionId,
      cookies,
    });
    if (price.ok) data.price = price.data;
    else warnings.push(`price: ${price.error}`);
  } else if (opts.checkIn || opts.checkOut) {
    warnings.push("price skipped: need both checkIn and checkOut");
  }

  emit({ t: "parse", endpoint: "get-details", parserVersion: parsed.parserVersion, warnings, durationMs: Date.now() - t0 });
  return {
    ok: true,
    data,
    raw: meta.raw,
    meta: { fetchedAt: new Date().toISOString(), endpoint: "get-details", durationMs: Date.now() - t0, parserVersion: parsed.parserVersion, warnings, mode: "live" },
  };
}

function scrapeApiKey(html: string): string | null {
  const m = html.match(/"api_config":\{"key":"([^"]+)"/);
  return m?.[1] ?? null;
}

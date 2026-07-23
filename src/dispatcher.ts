import { z } from "zod";
import type { Envelope } from "./types/envelope.js";

/**
 * Dispatcher — routes ?endpoint=<name> to the handler, parses ?mode + ?raw, validates input
 * with Zod, returns the envelope. Every request goes through here; the Lambda handler is thin.
 */

export interface DispatchEvent {
  endpoint: string;
  mode: "live" | "reprocess";
  raw?: unknown;
  [k: string]: unknown;
}

const DispatchSchema = z.object({
  endpoint: z.string().min(1),
  mode: z.enum(["live", "reprocess"]).default("live"),
  raw: z.unknown().optional(),
});

type Handler = (opts: any) => Promise<Envelope<any>>;
const handlers = new Map<string, Handler>();

export function register(endpoint: string, handler: Handler): void {
  handlers.set(endpoint, handler);
}

export function listEndpoints(): string[] {
  return [...handlers.keys()];
}

export async function dispatch(event: DispatchEvent): Promise<Envelope<any>> {
  const parsed = DispatchSchema.safeParse(event);
  if (!parsed.success) {
    return { ok: false, error: `invalid request: ${parsed.error.message}`, code: "input" };
  }
  const { endpoint, mode, raw } = parsed.data;
  const handler = handlers.get(endpoint);
  if (!handler) {
    return { ok: false, error: `unknown endpoint: ${endpoint}`, code: "input" };
  }

  if (mode === "reprocess" && raw === undefined) {
    return { ok: false, error: "reprocess mode requires `raw`", code: "input" };
  }

  const t0 = Date.now();
  try {
    const { mode: _mode, raw: _raw, endpoint: _endpoint, ...rest } = event;
  return await handler({ mode, raw, ...rest });
  } catch (e) {
    return { ok: false, error: (e as Error).message, code: "handler-threw", meta: { fetchedAt: null, endpoint, durationMs: Date.now() - t0, parserVersion: "none", warnings: [(e as Error).message], mode } };
  }
}

// ---- register all endpoints ----
import { getApiKey } from "./endpoints/get-api-key.js";
import { getDetails } from "./endpoints/get-details.js";
import { getMetadataFromUrl } from "./endpoints/get-metadata-from-url.js";
import { getPrice } from "./endpoints/get-price.js";
import { getReviews } from "./endpoints/get-reviews.js";
import { getCalendar } from "./endpoints/get-calendar.js";
import { getHostDetails } from "./endpoints/get-host-details.js";
import { getListingsFromUser } from "./endpoints/get-listings-from-user.js";
import { getMarkets } from "./endpoints/get-markets.js";
import { getPlacesIds } from "./endpoints/get-places-ids.js";
import { searchAll } from "./endpoints/search-all.js";
import { searchFirstPage } from "./endpoints/search-first-page.js";
import { searchAllFromUrl } from "./endpoints/search-all-from-url.js";
import { fetchStaysSearchHashEndpoint } from "./endpoints/fetch-stays-search-hash.js";
import { experienceSearch } from "./endpoints/experience-search.js";
import { experienceSearchByPlaceId } from "./endpoints/experience-search-by-place-id.js";

register("get-api-key", getApiKey as Handler);
register("get-details", getDetails as Handler);
register("get-metadata-from-url", getMetadataFromUrl as Handler);
register("get-price", getPrice as Handler);
register("get-reviews", getReviews as Handler);
register("get-calendar", getCalendar as Handler);
register("get-host-details", getHostDetails as Handler);
register("get-listings-from-user", getListingsFromUser as Handler);
register("get-markets", getMarkets as Handler);
register("get-places-ids", getPlacesIds as Handler);
register("search-all", searchAll as Handler);
register("search-first-page", searchFirstPage as Handler);
register("search-all-from-url", searchAllFromUrl as Handler);
register("fetch-stays-search-hash", fetchStaysSearchHashEndpoint as Handler);
register("experience-search", experienceSearch as Handler);
register("experience-search-by-place-id", experienceSearchByPlaceId as Handler);

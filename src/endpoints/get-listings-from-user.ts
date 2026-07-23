import type { Envelope } from "../types/envelope.js";
import { beehiveListingsRaw } from "../parsers/raw.js";
import { parseHostListings } from "../parsers/host.js";
import { encodeHostId } from "../codecs/ids.js";
import { createPaginatedEndpoint } from "../lib/endpoint.js";

/**
 * get-listings-from-user — UserProfileBeehiveListingQuery, paginated offset 1000.
 * Ports pyairbnb's host.py. Returns the raw listing blobs (caller can parse each).
 */

export type GetListingsMode =
  | { mode: "live"; hostId: string; apiKey: string }
  | { mode: "reprocess"; raw: unknown };

const LIMIT = 1000;

const fetchListings = createPaginatedEndpoint<
  { listings: unknown[]; count: number },
  unknown,
  typeof beehiveListingsRaw,
  Extract<GetListingsMode, { mode: "live" }>
>({
  operation: "UserProfileBeehiveListingQuery",
  method: "GET",
  rawSchema: beehiveListingsRaw,
  parse: parseHostListings,
  name: "get-listings-from-user",
  getApiKey: (opts) => opts.apiKey,
  buildVariables: (opts, page) => ({ userId: encodeHostId(opts.hostId), offset: page * LIMIT, limit: LIMIT }),
  extractItems: (data) => data.listings,
  getNextCursor: () => null,
  shouldStop: (data) => data.count < LIMIT,
});

/** getListingsFromUser returns { listings, count } — wrap after the paginated call. */
export async function getListingsFromUser(opts: GetListingsMode): Promise<Envelope<{ listings: unknown[]; count: number }>> {
  const res = await fetchListings(opts as any);
  if (!res.ok) return res as any;
  return { ...res, data: { listings: [...res.data], count: res.data.length } };
}

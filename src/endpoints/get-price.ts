import type { PriceQuote } from "../types/domain.js";
import { staysPdpRaw } from "../parsers/raw.js";
import { parsePrice } from "../parsers/price.js";
import { encodeRoomId } from "../codecs/ids.js";
import { createEndpoint } from "../lib/endpoint.js";

/**
 * get-price — StaysPdpSections quote. Ports pyairbnb's price.py.
 * REQUIRES impression_id + cookies from a prior listing-page scrape (issue #55).
 * Without them the call fails; get-details handles the two-step flow.
 */

export type GetPriceMode =
  | {
      mode: "live";
      roomId: string;
      checkIn: string;
      checkOut: string;
      adults?: number;
      currency?: string;
      apiKey: string;
      impressionId: string;
      cookies?: Record<string, string>;
    }
  | { mode: "reprocess"; raw: unknown };

export const getPrice = createEndpoint<PriceQuote, typeof staysPdpRaw, Extract<GetPriceMode, { mode: "live" }>>({
  operation: "StaysPdpSections",
  method: "GET",
  rawSchema: staysPdpRaw,
  parse: parsePrice,
  name: "get-price",
  getApiKey: (opts) => opts.apiKey,
  getCurrency: (opts) => opts.currency,
  buildVariables: (opts) => ({
    request: {
      id: encodeRoomId(opts.roomId, "DemandStayListing"),
      adults: opts.adults ?? 1,
      checkIn: opts.checkIn,
      checkOut: opts.checkOut,
      impressionId: opts.impressionId,
    },
  }),
});

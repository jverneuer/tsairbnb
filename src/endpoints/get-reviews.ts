import type { Review } from "../types/domain.js";
import { staysReviewsRaw } from "../parsers/raw.js";
import { parseReviews } from "../parsers/reviews.js";
import { createPaginatedEndpoint } from "../lib/endpoint.js";

/**
 * get-reviews — StaysPdpReviewsQuery, paginated offset 50. Ports pyairbnb's reviews.py.
 * pyairbnb derives product_id + api_key from a prior details scrape; we take apiKey as input.
 */

export type GetReviewsMode =
  | { mode: "live"; roomUrl: string; roomId?: string; apiKey: string; language?: string }
  | { mode: "reprocess"; raw: unknown };

const LIMIT = 50;

export const getReviews = createPaginatedEndpoint<readonly Review[], Review, typeof staysReviewsRaw, Extract<GetReviewsMode, { mode: "live" }>>({
  operation: "StaysPdpReviewsQuery",
  method: "GET",
  rawSchema: staysReviewsRaw,
  parse: parseReviews,
  name: "get-reviews",
  getApiKey: (opts) => opts.apiKey,
  getLocale: (opts) => opts.language,
  buildVariables: (opts, page) => ({
    request: {
      limit: LIMIT,
      first: LIMIT,
      offset: page * LIMIT,
      sortingPreference: "MOST_RECENT",
      fieldSelector: "for_p3_translation_only",
    },
  }),
  extractItems: (data) => data,
  getNextCursor: () => null,
  shouldStop: (data) => data.length < LIMIT,
});

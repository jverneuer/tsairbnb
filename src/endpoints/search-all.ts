import type { SearchHit } from "../types/domain.js";
import { staysSearchRaw } from "../parsers/raw.js";
import { parseSearch } from "../parsers/search.js";
import { getConfig } from "../config/load.js";
import { createPaginatedEndpoint } from "../lib/endpoint.js";

/**
 * search-all — StaysSearch, paginated via nextPageCursor. Ports pyairbnb's start.py.
 * Reads results.searchResults (NOT mapResults — see issues #41/#42).
 */

export interface SearchAllVariables {
  checkIn?: string;
  checkOut?: string;
  neLat?: number;
  neLong?: number;
  swLat?: number;
  swLong?: number;
  zoomValue?: number;
  priceMin?: number;
  priceMax?: number;
  placeType?: string;
  amenities?: string[];
  freeCancellation?: boolean;
  adults?: number;
  children?: number;
  infants?: number;
  minBedrooms?: number;
  minBeds?: number;
  minBathrooms?: number;
}

export type SearchAllMode =
  | { mode: "live"; apiKey: string; variables: SearchAllVariables; currency?: string; language?: string }
  | { mode: "reprocess"; raw: unknown };

export const searchAll = createPaginatedEndpoint<
  { readonly hits: readonly SearchHit[]; readonly nextCursor: string | null },
  SearchHit,
  typeof staysSearchRaw,
  Extract<SearchAllMode, { mode: "live" }>
>({
  operation: "StaysSearch",
  method: "POST",
  rawSchema: staysSearchRaw,
  parse: parseSearch,
  name: "search-all",
  getApiKey: (opts) => opts.apiKey,
  getLocale: (opts) => opts.language,
  getCurrency: (opts) => opts.currency,
  buildVariables: (opts, _page, cursor) => buildVariables(opts.variables, cursor),
  extractItems: (data) => data.hits,
  getNextCursor: (data) => data.nextCursor,
});

function buildVariables(v: SearchAllVariables, cursor: string | null) {
  const itemsPerGrid = getConfig().itemsPerGrid;
  return {
    staysSearchRequest: {
      cursor: cursor ?? undefined,
      itemsPerGrid,
      rooms: v.minBedrooms ?? 0,
      adults: v.adults ?? 0,
      children: v.children ?? 0,
      infants: v.infants ?? 0,
      priceMin: v.priceMin ?? undefined,
      priceMax: v.priceMax ?? undefined,
      placeType: v.placeType ?? undefined,
      amenities: v.amenities ?? [],
      freeCancellation: v.freeCancellation ?? false,
      checkIn: v.checkIn ?? undefined,
      checkOut: v.checkOut ?? undefined,
      neLat: v.neLat ?? undefined,
      neLng: v.neLong ?? undefined,
      swLat: v.swLat ?? undefined,
      swLng: v.swLong ?? undefined,
      zoomValue: v.zoomValue ?? undefined,
    },
    staysMapSearchRequest: {}, // pyairbnb sends both every request
  };
}

export function buildVariablesPublic(v: SearchAllVariables, cursor: string | null) {
  return buildVariables(v, cursor);
}

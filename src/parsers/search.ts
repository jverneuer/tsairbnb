import { path } from "../lib/get.js";
import { decodeListingId } from "../codecs/ids.js";
import { parsePriceString, parseRatingString } from "../lib/price.js";
import type { SearchHit } from "../types/domain.js";
import type { ParserStrategy } from "./registry.js";
import type { StaysSearchRaw } from "./raw.js";

/**
 * Search parser. pyairbnb reads `data.presentation.staysSearch.results.searchResults`
 * (NOT mapResults — see issues #41/#42). Each hit carries a base64-encoded
 * `demandStayListing.id`.
 */

const RESULTS_PATH = "data.presentation.staysSearch.results.searchResults";
const CURSOR_PATH = "data.presentation.staysSearch.results.paginationInfo.nextPageCursor";

export const searchStrategies: ParserStrategy<{ readonly hits: readonly SearchHit[]; readonly nextCursor: string | null }>[] = [
  {
    name: "stays-search",
    detect: (raw) => Array.isArray(path(raw, RESULTS_PATH)),
    parse: (raw, warnings) => {
      const results = path(raw, RESULTS_PATH) as unknown[];
      const hits = results
        .filter((r) => {
          const t = path(r, "__typename");
          return !t || t === "StaySearchResult";
        })
        .map((r) => {
          const demand = path(r, "demandStayListing") as Record<string, unknown>;
          const price = path(r, "structuredDisplayPrice") as Record<string, unknown>;
          const primary = path(price, "primaryLine") as Record<string, unknown>;
          return {
            roomId: decodeListingId(String(path(demand, "id") ?? "")) ?? null,
            title: path(r, "title") as string | null,
            name: path(demand, "description.name.localizedStringWithTranslationPreference") as string | null,
            coordinates: {
              latitude: path(demand, "location.coordinate.latitude") as number | null ?? null,
              longitude: path(demand, "location.coordinate.longitude") as number | null ?? null,
            },
            rating: parseRatingString(String(path(r, "avgRatingLocalized") ?? "")) ?? { value: null, reviewCount: null as number | null },
            badges: ((path(r, "badges") ?? []) as unknown[]).map((b) => path(b, "loggingContext.badgeType")).filter(Boolean) as string[],
            images: ((path(r, "contextualPictures") ?? []) as unknown[]).map((p) => path(p, "picture")).filter(Boolean) as string[],
            price: primary
              ? {
                  unit: parsePriceString(String(path(primary, "originalPrice") ?? path(primary, "price") ?? "")),
                  discount: path(primary, "discountedPrice") as string | null,
                  total: extractTotal(primary),
                }
              : null,
          } satisfies SearchHit;
        });
      const nextCursor = (path(raw, CURSOR_PATH) ?? null) as string | null;
      if (hits.length === 0) warnings.push("stays-search: no StaySearchResult hits");
      return { hits, nextCursor };
    },
  },
  {
    name: "bare",
    detect: () => true,
    parse: (_raw, warnings) => {
      warnings.push("bare: no stays-search shape matched");
      return { hits: [], nextCursor: null };
    },
  },
];

function extractTotal(primary: unknown): string | null {
  // pyairbnb splits the secondary line on spaces; preserve the raw string here.
  const secondary = path(primary, "secondaryLine");
  if (typeof secondary === "string") return secondary;
  return null;
}

export async function parseSearch(raw: StaysSearchRaw | unknown) {
  const { runParser } = await import("./registry.js");
  return runParser(searchStrategies, raw as unknown);
}

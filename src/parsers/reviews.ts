import { path } from "../lib/get.js";
import { parseRatingString } from "../lib/price.js";
import type { Review } from "../types/domain.js";
import type { ParserStrategy } from "./registry.js";
import type { StaysPdpReviewsQueryRaw } from "./raw.js";

/**
 * Reviews parser. pyairbnb paginates offset 50, reading
 * `data.presentation.stayProductDetailPage.reviews.reviews`.
 */

const REVIEWS_PATH = "data.presentation.stayProductDetailPage.reviews.reviews";

export const reviewStrategies: ParserStrategy<readonly Review[]>[] = [
  {
    name: "p3-reviews",
    detect: (raw) => Array.isArray(path(raw, REVIEWS_PATH)),
    parse: (raw, warnings) => {
      const arr = path(raw, REVIEWS_PATH) as unknown[];
      const out: readonly Review[] = arr.map((r) => {
        const responsesRaw = path(r, "responses") ?? [];
        const responses = (Array.isArray(responsesRaw) ? responsesRaw : []).map((resp) => ({
          member: path(resp, "member.name")
            ? { name: path(resp, "member.name") as string | null }
            : null,
          response: path(resp, "response") as string | null,
        }));
        return {
          id: path(r, "id") as string | null,
          rating: parseRatingString(String(path(r, "ratingLocalized") ?? ""))?.value ?? null,
          createdAt: path(r, "createdAt") as string | null,
          reviewer:
            path(r, "reviewer.name") || path(r, "reviewer.id")
              ? {
                  name: path(r, "reviewer.name") as string | null,
                  id: path(r, "reviewer.id") as string | null,
                }
              : null,
          text: (path(r, "comments") ?? path(r, "text")) as string | null,
          language: path(r, "language") as string | null,
          responses,
        };
      });
      if (out.length === 0) warnings.push("p3-reviews: empty reviews array");
      return out;
    },
  },
  {
    name: "bare",
    detect: () => true,
    parse: (_raw, warnings) => {
      warnings.push("bare: no reviews shape matched");
      return [];
    },
  },
];

export async function parseReviews(raw: StaysPdpReviewsQueryRaw | unknown) {
  const { runParser } = await import("./registry.js");
  return runParser(reviewStrategies, raw as unknown);
}

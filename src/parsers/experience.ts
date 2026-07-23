import { path } from "../lib/get.js";
import { parseRatingString } from "../lib/price.js";
import type { ParserStrategy } from "./registry.js";
import type { ExperiencesSearchRaw } from "./raw.js";

export interface ExperienceHit {
  readonly id: string | null;
  readonly title: string | null;
  readonly rating: { readonly value: number | null; readonly reviewCount: number | null };
  readonly images: readonly string[];
  readonly price: string | null;
  readonly duration: string | null;
  readonly category: string | null;
}

const RESULTS_PATH = "data.presentation.experiencesSearch.results.searchResults";
const CURSOR_PATH = "data.presentation.experiencesSearch.results.paginationInfo.nextPageCursor";

export const experienceStrategies: ParserStrategy<{ hits: ExperienceHit[]; nextCursor: string | null }>[] = [
  {
    name: "experiences-search",
    detect: (raw) => Array.isArray(path(raw, RESULTS_PATH)),
    parse: (raw, warnings) => {
      const results = (path(raw, RESULTS_PATH) ?? []) as unknown[];
      const hits = results.map((r) => ({
        id: path(r, "id") as string | null,
        title: path(r, "title") as string | null,
        rating: parseRatingString(String(path(r, "avgRatingLocalized") ?? "")) ?? { value: null, reviewCount: null as number | null },
        images: ((path(r, "contextualPictures") ?? []) as unknown[]).map((p) => path(p, "picture")).filter(Boolean) as string[],
        price: (path(r, "priceString") ?? path(r, "price")) as string | null,
        duration: path(r, "duration") as string | null,
        category: path(r, "category") as string | null,
      }));
      if (hits.length === 0) warnings.push("experiences-search: empty searchResults");
      return { hits, nextCursor: (path(raw, CURSOR_PATH) ?? null) as string | null };
    },
  },
  {
    name: "bare",
    detect: () => true,
    parse: (_raw, warnings) => {
      warnings.push("bare: no experiences shape matched");
      return { hits: [], nextCursor: null };
    },
  },
];

export async function parseExperience(raw: ExperiencesSearchRaw | unknown) {
  const { runParser } = await import("./registry.js");
  return runParser(experienceStrategies, raw as unknown);
}

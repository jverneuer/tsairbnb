import { path } from "../lib/get.js";
import { parsePriceString } from "../lib/price.js";
import type { PriceQuote } from "../types/domain.js";
import type { ParserStrategy } from "./registry.js";
import type { StaysPdpSectionsRaw } from "./raw.js";

/**
 * Price parser. pyairbnb finds the section with `sectionId == "BOOK_IT_SIDEBAR"` and reads
 * `structuredDisplayPrice`. If the section carries a `localizedUnavailabilityMessage`, the
 * listing is unavailable for the dates -> we surface `available: false` rather than throwing.
 */

const SECTIONS_PATH = "data.presentation.stayProductDetailPage.sections.sections";

export const priceStrategies: ParserStrategy<PriceQuote>[] = [
  {
    name: "stays-pdp-sections",
    detect: (raw) => Array.isArray(path(raw, SECTIONS_PATH)),
    parse: (raw, warnings) => {
      const sections = path(raw, SECTIONS_PATH) as unknown[];
      const sidebar = sections.find((s) => path(s, "sectionId") === "BOOK_IT_SIDEBAR");
      if (!sidebar) {
        warnings.push("stays-pdp-sections: no BOOK_IT_SIDEBAR section");
        return { main: { price: null, discountedPrice: null, originalPrice: null, qualifier: null, details: {} }, available: true };
      }
      const unavail = path(sidebar, "localizedUnavailabilityMessage");
      if (unavail) {
        warnings.push(`stays-pdp-sections: listing unavailable: ${String(unavail)}`);
        return { main: { price: null, discountedPrice: null, originalPrice: null, qualifier: null, details: {} }, available: false } satisfies PriceQuote;
      }
      const display = path(sidebar, "structuredDisplayPrice") as Record<string, unknown> | undefined;
      const primary = path(display, "primaryLine") as Record<string, unknown> | undefined;
      const details = collectDetails(path(display, "explanationData.priceDetails"));
      return {
        main: {
          price: parsePriceString(String(path(primary, "discountedPrice") ?? path(primary, "originalPrice") ?? path(primary, "price") ?? "")),
          discountedPrice: parsePriceString(String(path(primary, "discountedPrice") ?? "")),
          originalPrice: parsePriceString(String(path(primary, "originalPrice") ?? "")),
          qualifier: (path(primary, "qualifier") ?? null) as string | null,
          details,
        },
        available: true,
      } satisfies PriceQuote;
    },
  },
  {
    name: "bare",
    detect: () => true,
    parse: (_raw, warnings) => {
      warnings.push("bare: no price shape matched");
      return { main: { price: null, discountedPrice: null, originalPrice: null, qualifier: null, details: {} }, available: true } satisfies PriceQuote;
    },
  },
];

function collectDetails(priceDetails: unknown): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!Array.isArray(priceDetails)) return out;
  for (const detail of priceDetails) {
    const items = (path(detail, "items") ?? []) as unknown[];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const desc = path(item, "description") ?? path(item, "title");
      const price = path(item, "priceString") ?? path(item, "price");
      if (desc && price) out[String(desc)] = String(price);
    }
  }
  return out;
}

export async function parsePrice(raw: StaysPdpSectionsRaw | unknown) {
  const { runParser } = await import("./registry.js");
  return runParser(priceStrategies, raw as unknown);
}

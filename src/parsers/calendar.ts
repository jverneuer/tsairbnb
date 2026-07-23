import { path } from "../lib/get.js";
import { parsePriceString } from "../lib/price.js";
import type { CalendarMonth } from "../types/domain.js";
import type { ParserStrategy } from "./registry.js";
import type { PdpAvailabilityCalendarRaw } from "./raw.js";

/**
 * Calendar parser. pyairbnb reads `data.merlin.pdpAvailabilityCalendar.calendarMonths`
 * (note: under data.merlin, NOT data.presentation).
 */

const CAL_PATH = "data.merlin.pdpAvailabilityCalendar.calendarMonths";

export const calendarStrategies: ParserStrategy<readonly CalendarMonth[]>[] = [
  {
    name: "pdp-availability",
    detect: (raw) => Array.isArray(path(raw, CAL_PATH)),
    parse: (raw, warnings) => {
      const months = (path(raw, CAL_PATH) ?? []) as unknown[];
      const out = months.map((m) => {
        const days = ((path(m, "days") ?? []) as unknown[]).map((d) => ({
          date: String(path(d, "date") ?? ""),
          available: Boolean(path(d, "available") ?? false),
          price: parsePriceString(String(path(d, "priceString") ?? path(d, "price") ?? "")),
          minNights: path(d, "minNights") as number | null,
        }));
        return {
          month: path(m, "month") as number | null,
          year: path(m, "year") as number | null,
          days,
        } satisfies CalendarMonth;
      });
      if (out.length === 0) warnings.push("pdp-availability: empty calendarMonths");
      return out;
    },
  },
  {
    name: "bare",
    detect: () => true,
    parse: (_raw, warnings) => {
      warnings.push("bare: no calendar shape matched");
      return [];
    },
  },
];

export async function parseCalendar(raw: PdpAvailabilityCalendarRaw | unknown) {
  const { runParser } = await import("./registry.js");
  return runParser(calendarStrategies, raw as unknown);
}

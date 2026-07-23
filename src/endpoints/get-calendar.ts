import type { Envelope } from "../types/envelope.js";
import type { CalendarMonth } from "../types/domain.js";
import { pdpCalendarRaw } from "../parsers/raw.js";
import { parseCalendar } from "../parsers/calendar.js";
import { createEndpoint } from "../lib/endpoint.js";

/**
 * get-calendar — PdpAvailabilityCalendar, 12 months from today. Ports pyairbnb's calendarinfo.py.
 * Note: response lives under data.merlin (NOT data.presentation).
 */

export type GetCalendarMode =
  | { mode: "live"; roomId: string; apiKey: string; months?: number; month?: number; year?: number }
  | { mode: "reprocess"; raw: unknown };

export const getCalendar = createEndpoint<readonly CalendarMonth[], typeof pdpCalendarRaw, Extract<GetCalendarMode, { mode: "live" }>>({
  operation: "PdpAvailabilityCalendar",
  method: "GET",
  rawSchema: pdpCalendarRaw,
  parse: parseCalendar,
  name: "get-calendar",
  getApiKey: (opts) => opts.apiKey,
  buildVariables: (opts) => {
    const now = new Date();
    return {
      request: {
        count: opts.months ?? 12,
        listingId: opts.roomId,
        month: opts.month ?? now.getMonth() + 1,
        year: opts.year ?? now.getFullYear(),
      },
    };
  },
});

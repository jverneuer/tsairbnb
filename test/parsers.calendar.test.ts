import { describe, it, expect } from "vitest";
import { calendarStrategies, parseCalendar } from "../src/parsers/calendar.js";

const raw = {
  data: {
    merlin: {
      pdpAvailabilityCalendar: {
        calendarMonths: [
          {
            month: 7,
            year: 2026,
            days: [
              { date: "2026-07-01", available: true, priceString: "$50", minNights: 2 },
              { date: "2026-07-02", available: false, price: "$55", minNights: 1 },
            ],
          },
        ],
      },
    },
  },
};

describe("calendarStrategies", () => {
  it("pdp-availability detects array at path", () => {
    expect(calendarStrategies[0]!.detect(raw)).toBe(true);
    expect(calendarStrategies[0]!.detect({})).toBe(false);
  });
  it("pdp-availability returns false when path is not array", () => {
    expect(calendarStrategies[0]!.detect({ data: { merlin: { pdpAvailabilityCalendar: { calendarMonths: "not-array" } } } })).toBe(false);
    expect(calendarStrategies[0]!.detect({ data: { merlin: { pdpAvailabilityCalendar: { calendarMonths: 42 } } } })).toBe(false);
    expect(calendarStrategies[0]!.detect({ data: { merlin: { pdpAvailabilityCalendar: { calendarMonths: null } } } })).toBe(false);
    expect(calendarStrategies[0]!.detect({ data: { merlin: { pdpAvailabilityCalendar: { calendarMonths: {} } } } })).toBe(false);
    expect(calendarStrategies[0]!.detect({ data: { merlin: { pdpAvailabilityCalendar: { calendarMonths: true } } } })).toBe(false);
  });
  it("bare always detects", () => {
    expect(calendarStrategies[1]!.detect({})).toBe(true);
  });
  it("pdp-availability parses months/days", () => {
    const result = calendarStrategies[0]!.parse(raw, []);
    expect(result.length).toBe(1);
    expect(result[0]!.month).toBe(7);
    expect(result[0]!.year).toBe(2026);
    expect(result[0]!.days.length).toBe(2);
    expect(result[0]!.days[0]!.price).toEqual({ amount: 50, currency: "$" });
    expect(result[0]!.days[0]!.minNights).toBe(2);
    expect(result[0]!.days[1]!.available).toBe(false);
  });
  it("pdp-availability handles missing days array", () => {
    const warnings: string[] = [];
    const result = calendarStrategies[0]!.parse(
      { data: { merlin: { pdpAvailabilityCalendar: { calendarMonths: [{ month: 7, year: 2026 }] } } } },
      warnings,
    );
    expect(result.length).toBe(1);
    expect(result[0]!.days).toEqual([]);
  });
  it("pdp-availability handles days with missing fields", () => {
    const warnings: string[] = [];
    const result = calendarStrategies[0]!.parse(
      { data: { merlin: { pdpAvailabilityCalendar: { calendarMonths: [{ month: 7, year: 2026, days: [{}] }] } } } },
      warnings,
    );
    expect(result[0]!.days[0]!.date).toBe("");
    expect(result[0]!.days[0]!.available).toBe(false);
    expect(result[0]!.days[0]!.price).toBeNull();
  });
  it("pdp-availability warns on empty calendarMonths", () => {
    const warnings: string[] = [];
    calendarStrategies[0]!.parse({ data: { merlin: { pdpAvailabilityCalendar: { calendarMonths: [] } } } }, warnings);
    expect(warnings.some((w) => w.includes("empty"))).toBe(true);
  });
  it("bare returns empty + warning", () => {
    const warnings: string[] = [];
    const result = calendarStrategies[1]!.parse({}, warnings);
    expect(result).toEqual([]);
    expect(warnings.some((w) => w.includes("no calendar shape"))).toBe(true);
  });
});

describe("parseCalendar", () => {
  it("runs strategy registry", async () => {
    const result = await parseCalendar(raw);
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("pdp-availability");
  });
  it("falls back to bare on unknown shape", async () => {
    const result = await parseCalendar({});
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("bare");
  });
});

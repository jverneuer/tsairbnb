import { describe, it, expect } from "vitest";
import { experienceStrategies, parseExperience } from "../src/parsers/experience.js";

const raw = {
  data: {
    presentation: {
      experiencesSearch: {
        results: {
          searchResults: [
            {
              id: "exp1",
              title: "Wine Tour",
              avgRatingLocalized: "4.8 (12 reviews)",
              contextualPictures: [{ picture: "http://img/1.jpg" }, { picture: "http://img/2.jpg" }],
              priceString: "€45",
              duration: "3 hours",
              category: "Food & drink",
            },
          ],
          paginationInfo: { nextPageCursor: "cursor123" },
        },
      },
    },
  },
};

describe("experienceStrategies", () => {
  it("experiences-search detects array at path", () => {
    expect(experienceStrategies[0]!.detect(raw)).toBe(true);
    expect(experienceStrategies[0]!.detect({})).toBe(false);
  });
  it("bare always detects", () => {
    expect(experienceStrategies[1]!.detect({})).toBe(true);
  });
  it("experiences-search parses hits + cursor", () => {
    const result = experienceStrategies[0]!.parse(raw, []);
    expect(result.hits.length).toBe(1);
    expect(result.hits[0]!.id).toBe("exp1");
    expect(result.hits[0]!.title).toBe("Wine Tour");
    expect(result.hits[0]!.rating).toEqual({ value: 4.8, reviewCount: 12 });
    expect(result.hits[0]!.images.length).toBe(2);
    expect(result.hits[0]!.price).toBe("€45");
    expect(result.hits[0]!.duration).toBe("3 hours");
    expect(result.hits[0]!.category).toBe("Food & drink");
    expect(result.nextCursor).toBe("cursor123");
  });
  it("experiences-search warns on empty results", () => {
    const warnings: string[] = [];
    experienceStrategies[0]!.parse({ data: { presentation: { experiencesSearch: { results: { searchResults: [] } } } } }, warnings);
    expect(warnings.some((w) => w.includes("empty"))).toBe(true);
  });
  it("bare returns empty + warning", () => {
    const warnings: string[] = [];
    const result = experienceStrategies[1]!.parse({}, warnings);
    expect(result.hits).toEqual([]);
    expect(result.nextCursor).toBeNull();
    expect(warnings.some((w) => w.includes("no experiences shape"))).toBe(true);
  });
  it("experiences-search handles null results", () => {
    const result = experienceStrategies[0]!.parse({
      data: { presentation: { experiencesSearch: { results: { searchResults: null } } } },
    }, []);
    expect(result.hits).toEqual([]);
  });
  it("experiences-search handles missing paginationInfo", () => {
    const result = experienceStrategies[0]!.parse({
      data: { presentation: { experiencesSearch: { results: { searchResults: [{ id: "1" }] } } } },
    }, []);
    expect(result.nextCursor).toBeNull();
  });
});

describe("parseExperience", () => {
  it("runs strategy registry", async () => {
    const result = await parseExperience(raw);
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("experiences-search");
  });
  it("falls back to bare on unknown shape", async () => {
    const result = await parseExperience({});
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("bare");
  });
});

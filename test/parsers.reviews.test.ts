import { describe, it, expect } from "vitest";
import { reviewStrategies, parseReviews } from "../src/parsers/reviews.js";

const raw = {
  data: {
    presentation: {
      stayProductDetailPage: {
        reviews: {
          reviews: [
            {
              id: "r1",
              ratingLocalized: "5.0 (3 reviews)",
              createdAt: "2026-01-01",
              comments: "Great stay",
              language: "en",
              reviewer: { name: "Alice", id: "u1" },
              responses: [{ member: { name: "Host" }, response: "Thanks!" }],
            },
          ],
        },
      },
    },
  },
};

describe("reviewStrategies", () => {
  it("p3-reviews detects array at path", () => {
    expect(reviewStrategies[0]!.detect(raw)).toBe(true);
    expect(reviewStrategies[0]!.detect({})).toBe(false);
  });
  it("p3-reviews returns false when path is not array", () => {
    expect(reviewStrategies[0]!.detect({ data: { presentation: { stayProductDetailPage: { reviews: { reviews: "not-array" } } } } })).toBe(false);
    expect(reviewStrategies[0]!.detect({ data: { presentation: { stayProductDetailPage: { reviews: { reviews: 42 } } } } })).toBe(false);
    expect(reviewStrategies[0]!.detect({ data: { presentation: { stayProductDetailPage: { reviews: { reviews: null } } } } })).toBe(false);
    expect(reviewStrategies[0]!.detect({ data: { presentation: { stayProductDetailPage: { reviews: { reviews: {} } } } } })).toBe(false);
    expect(reviewStrategies[0]!.detect({ data: { presentation: { stayProductDetailPage: { reviews: { reviews: true } } } } })).toBe(false);
  });
  it("bare always detects", () => {
    expect(reviewStrategies[1]!.detect({})).toBe(true);
  });
  it("p3-reviews parses reviews", () => {
    const result = reviewStrategies[0]!.parse(raw, []);
    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe("r1");
    expect(result[0]!.rating).toBe(5.0);
    expect(result[0]!.createdAt).toBe("2026-01-01");
    expect(result[0]!.text).toBe("Great stay");
    expect(result[0]!.language).toBe("en");
    expect(result[0]!.reviewer).toEqual({ name: "Alice", id: "u1" });
    expect(result[0]!.responses.length).toBe(1);
    expect(result[0]!.responses[0]!.member).toEqual({ name: "Host" });
    expect(result[0]!.responses[0]!.response).toBe("Thanks!");
  });
  it("p3-reviews handles responses when not an array", () => {
    const result = reviewStrategies[0]!.parse(
      { data: { presentation: { stayProductDetailPage: { reviews: { reviews: [{ id: "r2", ratingLocalized: "4.0", text: "ok", responses: "not-array" }] } } } } },
      [],
    );
    expect(result[0]!.responses).toEqual([]);
  });
  it("p3-reviews handles responses when null", () => {
    const result = reviewStrategies[0]!.parse(
      { data: { presentation: { stayProductDetailPage: { reviews: { reviews: [{ id: "r3", ratingLocalized: "4.0", text: "ok", responses: null }] } } } } },
      [],
    );
    expect(result[0]!.responses).toEqual([]);
  });
  it("p3-reviews handles responses when object", () => {
    const result = reviewStrategies[0]!.parse(
      { data: { presentation: { stayProductDetailPage: { reviews: { reviews: [{ id: "r4", ratingLocalized: "4.0", text: "ok", responses: { member: { name: "H" }, response: "R" } }] } } } } },
      [],
    );
    expect(result[0]!.responses).toEqual([]);
  });
  it("p3-reviews handles response with missing member name", () => {
    const result = reviewStrategies[0]!.parse(
      { data: { presentation: { stayProductDetailPage: { reviews: { reviews: [{ id: "r5", ratingLocalized: "4.0", text: "ok", responses: [{ response: "Thanks" }] }] } } } } },
      [],
    );
    expect(result[0]!.responses[0]!.member).toBeNull();
    expect(result[0]!.responses[0]!.response).toBe("Thanks");
  });
  it("p3-reviews handles missing reviewer", () => {
    const result = reviewStrategies[0]!.parse(
      { data: { presentation: { stayProductDetailPage: { reviews: { reviews: [{ id: "r2", ratingLocalized: "4.0", text: "ok" }] } } } } },
      [],
    );
    expect(result[0]!.reviewer).toBeNull();
  });
  it("p3-reviews warns on empty", () => {
    const warnings: string[] = [];
    reviewStrategies[0]!.parse({ data: { presentation: { stayProductDetailPage: { reviews: { reviews: [] } } } } }, warnings);
    expect(warnings.some((w) => w.includes("empty"))).toBe(true);
  });
  it("bare returns empty + warning", () => {
    const warnings: string[] = [];
    const result = reviewStrategies[1]!.parse({}, warnings);
    expect(result).toEqual([]);
    expect(warnings.some((w) => w.includes("no reviews shape"))).toBe(true);
  });
});

describe("parseReviews", () => {
  it("runs strategy registry", async () => {
    const result = await parseReviews(raw);
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("p3-reviews");
  });
  it("falls back to bare on unknown shape", async () => {
    const result = await parseReviews({});
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("bare");
  });
});

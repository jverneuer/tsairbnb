import { describe, it, expect } from "vitest";
import { searchStrategies, parseSearch } from "../src/parsers/search.js";

const raw = {
  data: {
    presentation: {
      staysSearch: {
        results: {
          searchResults: [
            {
              __typename: "StaySearchResult",
              id: "r1",
              title: "Cozy Apt",
              demandStayListing: {
                id: "RGVtYW5kU3RheUxpc3Rpbmc6MTIz",
                description: { name: { localizedStringWithTranslationPreference: "Cozy Apt" } },
                location: { coordinate: { latitude: 41.99, longitude: 21.43 } },
              },
              structuredDisplayPrice: {
                primaryLine: {
                  price: "$100",
                  originalPrice: "$120",
                  discountedPrice: "$90",
                  secondaryLine: "total $200",
                },
              },
              avgRatingLocalized: "4.9 (19 reviews)",
              badges: [{ loggingContext: { badgeType: "SUPERHOST" } }],
              contextualPictures: [{ picture: "http://img/1.jpg" }],
            },
            {
              __typename: "OtherType",
              id: "filtered",
            },
          ],
          paginationInfo: { nextPageCursor: "cursor123" },
        },
      },
    },
  },
};

describe("searchStrategies", () => {
  it("stays-search detects array at path", () => {
    expect(searchStrategies[0]!.detect(raw)).toBe(true);
    expect(searchStrategies[0]!.detect({})).toBe(false);
  });
  it("bare always detects", () => {
    expect(searchStrategies[1]!.detect({})).toBe(true);
  });
  it("stays-search parses hits + cursor, filters non-StaySearchResult", () => {
    const result = searchStrategies[0]!.parse(raw, []);
    expect(result.hits.length).toBe(1);
    expect(result.hits[0]!.roomId).toBe(123);
    expect(result.hits[0]!.title).toBe("Cozy Apt");
    expect(result.hits[0]!.name).toBe("Cozy Apt");
    expect(result.hits[0]!.coordinates).toEqual({ latitude: 41.99, longitude: 21.43 });
    expect(result.hits[0]!.rating).toEqual({ value: 4.9, reviewCount: 19 });
    expect(result.hits[0]!.badges).toEqual(["SUPERHOST"]);
    expect(result.hits[0]!.images).toEqual(["http://img/1.jpg"]);
    expect(result.hits[0]!.price).toEqual({ unit: { amount: 120, currency: "$" }, discount: "$90", total: "total $200" });
    expect(result.nextCursor).toBe("cursor123");
  });
  it("stays-search extractTotal returns null when secondaryLine is not string", () => {
    const result = searchStrategies[0]!.parse(
      {
        data: {
          presentation: {
            staysSearch: {
              results: {
                searchResults: [
                  {
                    __typename: "StaySearchResult",
                    demandStayListing: { id: "RGVtYW5kU3RheUxpc3Rpbmc6MTIz" },
                    structuredDisplayPrice: {
                      primaryLine: {
                        price: "$100",
                        originalPrice: "$120",
                        secondaryLine: 42,
                      },
                    },
                  },
                ],
                paginationInfo: {},
              },
            },
          },
        },
      },
      [],
    );
    expect(result.hits[0]!.price!.total).toBeNull();
  });
  it("stays-search extractTotal returns null when secondaryLine is missing", () => {
    const result = searchStrategies[0]!.parse(
      {
        data: {
          presentation: {
            staysSearch: {
              results: {
                searchResults: [
                  {
                    __typename: "StaySearchResult",
                    demandStayListing: { id: "RGVtYW5kU3RheUxpc3Rpbmc6MTIz" },
                    structuredDisplayPrice: {
                      primaryLine: {
                        price: "$100",
                        originalPrice: "$120",
                      },
                    },
                  },
                ],
                paginationInfo: {},
              },
            },
          },
        },
      },
      [],
    );
    expect(result.hits[0]!.price!.total).toBeNull();
  });
  it("stays-search extractTotal returns null when secondaryLine is object", () => {
    const result = searchStrategies[0]!.parse(
      {
        data: {
          presentation: {
            staysSearch: {
              results: {
                searchResults: [
                  {
                    __typename: "StaySearchResult",
                    demandStayListing: { id: "RGVtYW5kU3RheUxpc3Rpbmc6MTIz" },
                    structuredDisplayPrice: {
                      primaryLine: {
                        price: "$100",
                        originalPrice: "$120",
                        secondaryLine: { value: "total" },
                      },
                    },
                  },
                ],
                paginationInfo: {},
              },
            },
          },
        },
      },
      [],
    );
    expect(result.hits[0]!.price!.total).toBeNull();
  });
  it("stays-search falls back to price when originalPrice missing", () => {
    const result = searchStrategies[0]!.parse(
      {
        data: {
          presentation: {
            staysSearch: {
              results: {
                searchResults: [
                  {
                    __typename: "StaySearchResult",
                    demandStayListing: { id: "RGVtYW5kU3RheUxpc3Rpbmc6MTIz" },
                    structuredDisplayPrice: {
                      primaryLine: { price: "$100" },
                    },
                  },
                ],
                paginationInfo: {},
              },
            },
          },
        },
      },
      [],
    );
    expect(result.hits[0]!.price!.unit).toEqual({ amount: 100, currency: "$" });
  });
  it("stays-search falls back to empty string when both prices missing", () => {
    const result = searchStrategies[0]!.parse(
      {
        data: {
          presentation: {
            staysSearch: {
              results: {
                searchResults: [
                  {
                    __typename: "StaySearchResult",
                    demandStayListing: { id: "RGVtYW5kU3RheUxpc3Rpbmc6MTIz" },
                    structuredDisplayPrice: {
                      primaryLine: {},
                    },
                  },
                ],
                paginationInfo: {},
              },
            },
          },
        },
      },
      [],
    );
    expect(result.hits[0]!.price!.unit).toBeNull();
  });
  it("stays-search handles hit with no primaryLine", () => {
    const result = searchStrategies[0]!.parse(
      {
        data: {
          presentation: {
            staysSearch: {
              results: {
                searchResults: [
                  {
                    __typename: "StaySearchResult",
                    demandStayListing: { id: "RGVtYW5kU3RheUxpc3Rpbmc6MTIz" },
                    structuredDisplayPrice: {},
                  },
                ],
                paginationInfo: {},
              },
            },
          },
        },
      },
      [],
    );
    expect(result.hits[0]!.price).toBeNull();
  });
  it("stays-search handles hit with no structuredDisplayPrice", () => {
    const result = searchStrategies[0]!.parse(
      {
        data: {
          presentation: {
            staysSearch: {
              results: {
                searchResults: [
                  {
                    __typename: "StaySearchResult",
                    demandStayListing: { id: "RGVtYW5kU3RheUxpc3Rpbmc6MTIz" },
                  },
                ],
                paginationInfo: {},
              },
            },
          },
        },
      },
      [],
    );
    expect(result.hits[0]!.price).toBeNull();
  });
  it("stays-search warns on empty hits", () => {
    const warnings: string[] = [];
    searchStrategies[0]!.parse({ data: { presentation: { staysSearch: { results: { searchResults: [] } } } } }, warnings);
    expect(warnings.some((w) => w.includes("no StaySearchResult"))).toBe(true);
  });
  it("stays-search nextCursor falls back to null when paginationInfo missing", () => {
    const result = searchStrategies[0]!.parse(
      { data: { presentation: { staysSearch: { results: { searchResults: [{ __typename: "StaySearchResult", demandStayListing: { id: "RGVtYW5kU3RheUxpc3Rpbmc6MTIz" } }] } } } } },
      [],
    );
    expect(result.nextCursor).toBeNull();
  });
  it("bare returns empty + warning", () => {
    const warnings: string[] = [];
    const result = searchStrategies[1]!.parse({}, warnings);
    expect(result.hits).toEqual([]);
    expect(result.nextCursor).toBeNull();
    expect(warnings.some((w) => w.includes("no stays-search shape"))).toBe(true);
  });
});

describe("parseSearch", () => {
  it("runs strategy registry", async () => {
    const result = await parseSearch(raw);
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("stays-search");
  });
  it("falls back to bare on unknown shape", async () => {
    const result = await parseSearch({});
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("bare");
  });
});

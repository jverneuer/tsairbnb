import { describe, it, expect } from "vitest";
import { listingStrategies, parseListing } from "../src/parsers/listing.js";

const v2026raw = {
  data: {
    presentation: {
      stayProductDetailPage: {
        id: "RGVtYW5kU3RheUxpc3Rpbmc6MTYxNDkwODQ4NTQ1NTczMzI2NA==",
        sections: {
          metadata: {
            loggingContext: {
              eventDataLogging: {
                listingLat: 41.99,
                listingLng: 21.43,
                starRating: 4.9,
                visibleReviewCount: 19,
                isSuperhost: true,
                homeTier: "luxury",
                personCapacity: 5,
                roomType: "Entire home",
              },
            },
          },
          sections: [
            {
              __typename: "HostProfileSection",
              hostAvatar: { userID: "123", name: "Maja" },
              hostProfileDescription: { htmlText: "About Maja" },
            },
            {
              __typename: "PhotoTourModalSection",
              photos: [{ picture: "http://img/1.jpg", caption: "Living" }, { picture: "http://img/2.jpg", caption: null }],
            },
            {
              __typename: "PdpTitleSection",
              title: "Cozy Apt",
            },
            {
              __typename: "PdpDescriptionSection",
              description: { htmlText: "<p>Nice place</p>" },
            },
            {
              __typename: "PdpHighlightsSection",
              highlights: [{ title: "Great location", subtitle: "Near center" }],
            },
            {
              __typename: "PoliciesSection",
              houseRules: { general: [{ title: "No smoking", values: ["strict"] }] },
            },
            {
              __typename: "LocationSection",
              seeAllLocations: [{ title: "Where you'll be", content: "Downtown" }],
            },
          ],
        },
      },
    },
    node: {
      pdpPresentation: {
        amenities: {
          seeAllAmenitiesGroups: [
            { title: "Basic", values: [{ title: "WiFi", subtitle: "Fast", available: true }] },
          ],
        },
      },
    },
  },
};

describe("listingStrategies", () => {
  it("v2026-graphql detects sections path", () => {
    expect(listingStrategies[0]!.detect(v2026raw)).toBe(true);
    expect(listingStrategies[0]!.detect({})).toBe(false);
  });
  it("bare always detects", () => {
    expect(listingStrategies[1]!.detect(null)).toBe(true);
    expect(listingStrategies[1]!.detect({})).toBe(true);
  });
  it("v2026-graphql parses all sections", () => {
    const result = listingStrategies[0]!.parse(v2026raw, []);
    expect(result.id).not.toBeNull();
    expect(result.id).toBeGreaterThan(0);
    expect(result.title).toBe("Cozy Apt");
    expect(result.description).toBe("<p>Nice place</p>");
    expect(result.host).toEqual({ id: "123", name: "Maja" });
    expect(result.about).toBe("About Maja");
    expect(result.photos.length).toBe(2);
    expect(result.highlights.length).toBe(1);
    expect(result.houseRules.length).toBe(1);
    expect(result.locationDescriptions.length).toBe(1);
    expect(result.amenities.length).toBe(1);
    expect(result.coordinates).toEqual({ latitude: 41.99, longitude: 21.43 });
    expect(result.rating).toEqual({ value: 4.9, reviewCount: 19 });
    expect(result.isSuperhost).toBe(true);
    expect(result.homeTier).toBe("luxury");
    expect(result.personCapacity).toBe(5);
    expect(result.roomType).toBe("Entire home");
  });
  it("bare parser with id at top level", () => {
    const result = listingStrategies[1]!.parse({ id: 42 }, []);
    expect(result.id).toBe(42);
  });
  it("bare parser with string id", () => {
    const result = listingStrategies[1]!.parse({ id: "abc" }, []);
    expect(result.id).toBeNull();
  });
  it("bare parser with nested id", () => {
    const result = listingStrategies[1]!.parse({ listing: { id: 99 } }, []);
    expect(result.id).toBe(99);
  });
  it("bare parser warns when id unresolved", () => {
    const warnings: string[] = [];
    listingStrategies[1]!.parse({}, warnings);
    expect(warnings.some((w) => w.includes("id"))).toBe(true);
  });
  it("v2026-graphql handles non-array sections", () => {
    const warnings: string[] = [];
    const result = listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: "not-array",
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.photos).toEqual([]);
    expect(result.houseRules).toEqual([]);
    expect(result.locationDescriptions).toEqual([]);
    expect(result.highlights).toEqual([]);
  });
  it("v2026-graphql handles non-array amenities", () => {
    const warnings: string[] = [];
    const result = listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [],
              },
            },
          },
          node: {
            pdpPresentation: {
              amenities: {
                seeAllAmenitiesGroups: "not-array",
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.amenities).toEqual([]);
  });
  it("v2026-graphql handles null amenities", () => {
    const warnings: string[] = [];
    const result = listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [],
              },
            },
          },
          node: {
            pdpPresentation: {
              amenities: {
                seeAllAmenitiesGroups: null,
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.amenities).toEqual([]);
  });
  it("v2026-graphql handles missing amenities", () => {
    const warnings: string[] = [];
    const result = listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [],
              },
            },
          },
          node: {
            pdpPresentation: {
              amenities: {},
            },
          },
        },
      },
      warnings,
    );
    expect(result.amenities).toEqual([]);
  });
  it("v2026-graphql handles non-string b64 id", () => {
    const warnings: string[] = [];
    const result = listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              id: 12345,
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.id).toBeNull();
    expect(warnings.some((w) => w.includes("id unresolved"))).toBe(true);
  });
  it("v2026-graphql handles short b64 id", () => {
    const warnings: string[] = [];
    const result = listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              id: "abc",
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.id).toBeNull();
    expect(warnings.some((w) => w.includes("id unresolved"))).toBe(true);
  });
  it("v2026-graphql handles b64 id that fails decode", () => {
    const warnings: string[] = [];
    const result = listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              id: "!!!invalid!!!",
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.id).toBeNull();
    expect(warnings.some((w) => w.includes("id unresolved"))).toBe(true);
  });
  it("v2026-graphql warns when title missing", () => {
    const warnings: string[] = [];
    listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              id: "RGVtYW5kU3RheUxpc3Rpbmc6MTYxNDkwODQ4NTQ1NTczMzI2NA==",
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(warnings.some((w) => w.includes("title missing"))).toBe(true);
  });
  it("v2026-graphql warns when no photos", () => {
    const warnings: string[] = [];
    listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              id: "RGVtYW5kU3RheUxpc3Rpbmc6MTYxNDkwODQ4NTQ1NTczMzI2NA==",
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [{ __typename: "PdpTitleSection", title: "T" }],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(warnings.some((w) => w.includes("no photos"))).toBe(true);
  });
  it("v2026-graphql handles non-array photos", () => {
    const warnings: string[] = [];
    const result = listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              id: "RGVtYW5kU3RheUxpc3Rpbmc6MTYxNDkwODQ4NTQ1NTczMzI2NA==",
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [
                  {
                    __typename: "PhotoTourModalSection",
                    photos: "not-array",
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.photos).toEqual([]);
  });
  it("v2026-graphql handles non-array houseRules general", () => {
    const warnings: string[] = [];
    const result = listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              id: "RGVtYW5kU3RheUxpc3Rpbmc6MTYxNDkwODQ4NTQ1NTczMzI2NA==",
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [
                  {
                    __typename: "PoliciesSection",
                    houseRules: { general: "not-array" },
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.houseRules).toEqual([]);
  });
  it("v2026-graphql handles non-object houseRules", () => {
    const warnings: string[] = [];
    const result = listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              id: "RGVtYW5kU3RheUxpc3Rpbmc6MTYxNDkwODQ4NTQ1NTczMzI2NA==",
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [
                  {
                    __typename: "PoliciesSection",
                    houseRules: "not-object",
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.houseRules).toEqual([]);
  });
  it("v2026-graphql handles non-array locationDescriptions", () => {
    const warnings: string[] = [];
    const result = listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              id: "RGVtYW5kU3RheUxpc3Rpbmc6MTYxNDkwODQ4NTQ1NTczMzI2NA==",
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [
                  {
                    __typename: "LocationSection",
                    seeAllLocations: "not-array",
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.locationDescriptions).toEqual([]);
  });
  it("v2026-graphql handles non-array highlights", () => {
    const warnings: string[] = [];
    const result = listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              id: "RGVtYW5kU3RheUxpc3Rpbmc6MTYxNDkwODQ4NTQ1NTczMzI2NA==",
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [
                  {
                    __typename: "PdpHighlightsSection",
                    highlights: "not-array",
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.highlights).toEqual([]);
  });
  it("v2026-graphql handles section with unknown type", () => {
    const warnings: string[] = [];
    const result = listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              id: "RGVtYW5kU3RheUxpc3Rpbmc6MTYxNDkwODQ4NTQ1NTczMzI2NA==",
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [
                  {
                    __typename: "UnknownSection",
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.id).not.toBeNull();
  });
  it("v2026-graphql handles section with sectionId fallback", () => {
    const warnings: string[] = [];
    const result = listingStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              id: "RGVtYW5kU3RheUxpc3Rpbmc6MTYxNDkwODQ4NTQ1NTczMzI2NA==",
              sections: {
                metadata: { loggingContext: { eventDataLogging: {} } },
                sections: [
                  {
                    sectionId: "SomeSection",
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.id).not.toBeNull();
  });
  it("bare parser with string id that is numeric", () => {
    const result = listingStrategies[1]!.parse({ id: "42" }, []);
    expect(result.id).toBe(42);
  });
});

describe("parseListing", () => {
  it("runs strategy registry", async () => {
    const result = await parseListing(v2026raw);
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("v2026-graphql");
  });
  it("falls back to bare on unknown shape", async () => {
    const result = await parseListing({});
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("bare");
  });
  it("handles null input", async () => {
    const result = await parseListing(null);
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("bare");
  });
});

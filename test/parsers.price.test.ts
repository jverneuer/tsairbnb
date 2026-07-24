import { describe, it, expect } from "vitest";
import { priceStrategies, parsePrice } from "../src/parsers/price.js";

const raw = {
  data: {
    presentation: {
      stayProductDetailPage: {
        sections: {
          sections: [
            {
              sectionId: "BOOK_IT_SIDEBAR",
              structuredDisplayPrice: {
                primaryLine: {
                  price: "$100",
                  originalPrice: "$120",
                  discountedPrice: "$90",
                  qualifier: "per night",
                },
                explanationData: {
                  priceDetails: [
                    {
                      items: [
                        { description: "Cleaning", priceString: "$20" },
                        { description: "Service fee", price: "$15" },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    },
  },
};

describe("priceStrategies", () => {
  it("stays-pdp-sections detects array at path", () => {
    expect(priceStrategies[0]!.detect(raw)).toBe(true);
    expect(priceStrategies[0]!.detect({})).toBe(false);
  });
  it("stays-pdp-sections returns false when path is not array", () => {
    expect(priceStrategies[0]!.detect({ data: { presentation: { stayProductDetailPage: { sections: { sections: "not-array" } } } } })).toBe(false);
    expect(priceStrategies[0]!.detect({ data: { presentation: { stayProductDetailPage: { sections: { sections: 42 } } } } })).toBe(false);
    expect(priceStrategies[0]!.detect({ data: { presentation: { stayProductDetailPage: { sections: { sections: null } } } } })).toBe(false);
    expect(priceStrategies[0]!.detect({ data: { presentation: { stayProductDetailPage: { sections: { sections: {} } } } } })).toBe(false);
  });
  it("bare always detects", () => {
    expect(priceStrategies[1]!.detect({})).toBe(true);
  });
  it("stays-pdp-sections parses sidebar quote", () => {
    const result = priceStrategies[0]!.parse(raw, []);
    expect(result.available).toBe(true);
    expect(result.main.price).toEqual({ amount: 90, currency: "$" });
    expect(result.main.originalPrice).toEqual({ amount: 120, currency: "$" });
    expect(result.main.discountedPrice).toEqual({ amount: 90, currency: "$" });
    expect(result.main.qualifier).toBe("per night");
    expect(result.main.details).toEqual({ Cleaning: "$20", "Service fee": "$15" });
  });
  it("stays-pdp-sections warns when no sidebar", () => {
    const warnings: string[] = [];
    const result = priceStrategies[0]!.parse({ data: { presentation: { stayProductDetailPage: { sections: { sections: [] } } } } }, warnings);
    expect(result.available).toBe(true);
    expect(warnings.some((w) => w.includes("no BOOK_IT_SIDEBAR"))).toBe(true);
  });
  it("stays-pdp-sections marks unavailable when unavail message present", () => {
    const warnings: string[] = [];
    const result = priceStrategies[0]!.parse(
      { data: { presentation: { stayProductDetailPage: { sections: { sections: [{ sectionId: "BOOK_IT_SIDEBAR", localizedUnavailabilityMessage: "Not available" }] } } } } },
      warnings,
    );
    expect(result.available).toBe(false);
    expect(warnings.some((w) => w.includes("unavailable"))).toBe(true);
  });
  it("bare returns empty + warning", () => {
    const warnings: string[] = [];
    const result = priceStrategies[1]!.parse({}, warnings);
    expect(result.available).toBe(true);
    expect(result.main.details).toEqual({});
    expect(warnings.some((w) => w.includes("no price shape"))).toBe(true);
  });
  it("stays-pdp-sections handles non-array priceDetails", () => {
    const warnings: string[] = [];
    const result = priceStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                sections: [
                  {
                    sectionId: "BOOK_IT_SIDEBAR",
                    structuredDisplayPrice: {
                      primaryLine: { price: "$100" },
                      explanationData: { priceDetails: "not-array" },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.main.details).toEqual({});
  });
  it("stays-pdp-sections handles null priceDetails", () => {
    const warnings: string[] = [];
    const result = priceStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                sections: [
                  {
                    sectionId: "BOOK_IT_SIDEBAR",
                    structuredDisplayPrice: {
                      primaryLine: { price: "$100" },
                      explanationData: { priceDetails: null },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.main.details).toEqual({});
  });
  it("stays-pdp-sections handles priceDetails with non-array items", () => {
    const warnings: string[] = [];
    const result = priceStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                sections: [
                  {
                    sectionId: "BOOK_IT_SIDEBAR",
                    structuredDisplayPrice: {
                      primaryLine: { price: "$100" },
                      explanationData: {
                        priceDetails: [
                          { items: "not-array" },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.main.details).toEqual({});
  });
  it("stays-pdp-sections handles priceDetails with null items", () => {
    const warnings: string[] = [];
    const result = priceStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                sections: [
                  {
                    sectionId: "BOOK_IT_SIDEBAR",
                    structuredDisplayPrice: {
                      primaryLine: { price: "$100" },
                      explanationData: {
                        priceDetails: [
                          { items: null },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.main.details).toEqual({});
  });
  it("stays-pdp-sections handles priceDetails with object items", () => {
    const warnings: string[] = [];
    const result = priceStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                sections: [
                  {
                    sectionId: "BOOK_IT_SIDEBAR",
                    structuredDisplayPrice: {
                      primaryLine: { price: "$100" },
                      explanationData: {
                        priceDetails: [
                          { items: { not: "array" } },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.main.details).toEqual({});
  });
  it("stays-pdp-sections handles priceDetails with missing items", () => {
    const warnings: string[] = [];
    const result = priceStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                sections: [
                  {
                    sectionId: "BOOK_IT_SIDEBAR",
                    structuredDisplayPrice: {
                      primaryLine: { price: "$100" },
                      explanationData: {
                        priceDetails: [
                          {},
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.main.details).toEqual({});
  });
  it("stays-pdp-sections handles priceDetails with item missing desc/price", () => {
    const warnings: string[] = [];
    const result = priceStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                sections: [
                  {
                    sectionId: "BOOK_IT_SIDEBAR",
                    structuredDisplayPrice: {
                      primaryLine: { price: "$100" },
                      explanationData: {
                        priceDetails: [
                          { items: [{ title: "Only title" }, { priceString: "Only price" }] },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.main.details).toEqual({});
  });
  it("stays-pdp-sections handles priceDetails with item using title fallback", () => {
    const warnings: string[] = [];
    const result = priceStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                sections: [
                  {
                    sectionId: "BOOK_IT_SIDEBAR",
                    structuredDisplayPrice: {
                      primaryLine: { price: "$100" },
                      explanationData: {
                        priceDetails: [
                          { items: [{ title: "Cleaning", priceString: "$20" }] },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.main.details).toEqual({ Cleaning: "$20" });
  });
  it("stays-pdp-sections handles priceDetails with item using price fallback", () => {
    const warnings: string[] = [];
    const result = priceStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                sections: [
                  {
                    sectionId: "BOOK_IT_SIDEBAR",
                    structuredDisplayPrice: {
                      primaryLine: { price: "$100" },
                      explanationData: {
                        priceDetails: [
                          { items: [{ description: "Cleaning", price: "$20" }] },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.main.details).toEqual({ Cleaning: "$20" });
  });
  it("stays-pdp-sections collectDetails returns empty for non-array priceDetails (L36)", () => {
    // L36 is the `!Array.isArray(priceDetails)` early return inside collectDetails.
    // We call collectDetails indirectly via parse with explanationData.priceDetails as a non-array.
    // Already covered by "handles non-array priceDetails" test above; this test explicitly covers L36.
    const warnings: string[] = [];
    const result = priceStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                sections: [
                  {
                    sectionId: "BOOK_IT_SIDEBAR",
                    structuredDisplayPrice: {
                      primaryLine: { price: "$100" },
                      explanationData: { priceDetails: "not-an-array" },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.main.details).toEqual({});
  });
  it("stays-pdp-sections handles priceDetails with item missing both desc and price", () => {
    const warnings: string[] = [];
    const result = priceStrategies[0]!.parse(
      {
        data: {
          presentation: {
            stayProductDetailPage: {
              sections: {
                sections: [
                  {
                    sectionId: "BOOK_IT_SIDEBAR",
                    structuredDisplayPrice: {
                      primaryLine: { price: "$100" },
                      explanationData: {
                        priceDetails: [
                          { items: [{ other: "field" }] },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      warnings,
    );
    expect(result.main.details).toEqual({});
  });
});

describe("parsePrice", () => {
  it("runs strategy registry", async () => {
    const result = await parsePrice(raw);
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("stays-pdp-sections");
  });
  it("falls back to bare on unknown shape", async () => {
    const result = await parsePrice({});
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("bare");
  });
});

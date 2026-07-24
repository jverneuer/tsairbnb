import { describe, it, expect } from "vitest";
import { hostProfileStrategies, hostListingsStrategies, parseHostProfile, parseHostListings } from "../src/parsers/host.js";

const profileRaw = {
  data: {
    presentation: {
      user: {
        id: "VXNlcjo0Mg==",
        name: "Maja",
        about: "Host bio",
        location: "Skopje",
        isSuperhost: true,
        responseRate: 95,
        responseTimeSeconds: 1800,
        listingsCount: 3,
      },
    },
  },
};

const listingsRaw = {
  data: {
    beehive: {
      getListOfListings: {
        listings: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
    },
  },
};

describe("hostProfileStrategies", () => {
  it("user-profile detects path", () => {
    expect(hostProfileStrategies[0]!.detect(profileRaw)).toBe(true);
    expect(hostProfileStrategies[0]!.detect({})).toBe(false);
  });
  it("bare always detects", () => {
    expect(hostProfileStrategies[1]!.detect({})).toBe(true);
  });
  it("user-profile parses profile", () => {
    const result = hostProfileStrategies[0]!.parse(profileRaw, []);
    expect(result.id).toBe("42");
    expect(result.name).toBe("Maja");
    expect(result.about).toBe("Host bio");
    expect(result.location).toBe("Skopje");
    expect(result.isSuperhost).toBe(true);
    expect(result.responseRate).toBe(95);
    expect(result.responseTime).toBe("within an hour");
    expect(result.listingsCount).toBe(3);
  });
  it("user-profile warns on missing name", () => {
    const warnings: string[] = [];
    hostProfileStrategies[0]!.parse({ data: { presentation: { user: {} } } }, warnings);
    expect(warnings.some((w) => w.includes("name missing"))).toBe(true);
  });
  it("user-profile handles response time buckets", () => {
    const warnings: string[] = [];
    const underHour = hostProfileStrategies[0]!.parse({ data: { presentation: { user: { id: "VXNlcjo0Mg==", name: "X", responseTimeSeconds: 3599 } } } }, warnings);
    expect(underHour.responseTime).toBe("within an hour");
    const underDay = hostProfileStrategies[0]!.parse({ data: { presentation: { user: { id: "VXNlcjo0Mg==", name: "X", responseTimeSeconds: 90000 } } } }, warnings);
    expect(underDay.responseTime).toBe("a day or more");
  });
  it("bare profile returns bare fields", () => {
    const warnings: string[] = [];
    const result = hostProfileStrategies[1]!.parse({}, warnings);
    expect(result.id).toBeNull();
    expect(result.name).toBeNull();
    expect(result.about).toBeNull();
    expect(warnings.some((w) => w.includes("no user shape"))).toBe(true);
  });
  it("user-profile handles response time within a day", () => {
    const result = hostProfileStrategies[0]!.parse({ data: { presentation: { user: { id: "VXNlcjo0Mg==", name: "X", responseTimeSeconds: 3600 } } } }, []);
    expect(result.responseTime).toBe("within a day");
  });
  it("bare profile decodes id at top level", () => {
    const result = hostProfileStrategies[1]!.parse({ id: "VXNlcjo0Mg==" }, []);
    expect(result.id).toBe("42");
  });
});

describe("hostListingsStrategies", () => {
  it("beehive-listings detects path", () => {
    expect(hostListingsStrategies[0]!.detect(listingsRaw)).toBe(true);
    expect(hostListingsStrategies[0]!.detect({})).toBe(false);
  });
  it("bare always detects", () => {
    expect(hostListingsStrategies[1]!.detect({})).toBe(true);
  });
  it("beehive-listings parses listings", () => {
    const result = hostListingsStrategies[0]!.parse(listingsRaw, []);
    expect(result.listings.length).toBe(3);
    expect(result.count).toBe(3);
  });
  it("beehive-listings warns on empty", () => {
    const warnings: string[] = [];
    hostListingsStrategies[0]!.parse({ data: { beehive: { getListOfListings: { listings: [] } } } }, warnings);
    expect(warnings.some((w) => w.includes("empty"))).toBe(true);
  });
  it("bare returns empty + warning", () => {
    const warnings: string[] = [];
    const result = hostListingsStrategies[1]!.parse({}, warnings);
    expect(result.listings).toEqual([]);
    expect(result.count).toBe(0);
    expect(warnings.some((w) => w.includes("no beehive shape"))).toBe(true);
  });
});

describe("parseHostProfile / parseHostListings", () => {
  it("parseHostProfile runs registry", async () => {
    const result = await parseHostProfile(profileRaw);
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("user-profile");
  });
  it("parseHostListings runs registry", async () => {
    const result = await parseHostListings(listingsRaw);
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.parserVersion).toBe("beehive-listings");
  });
});

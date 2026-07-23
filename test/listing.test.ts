import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseListing } from "../src/parsers/listing.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(__dirname, "fixtures/get-details", `${name}.json`), "utf8"));
}

describe("listing parser (golden-master)", () => {
  it("parses the 2026-07-23 fixture via v2026-graphql", async () => {
    const raw = loadFixture("2026-07-23");
    const result = await parseListing(raw);
    expect("error" in result).toBe(false);
    if ("error" in result) return;

    expect(result.parserVersion).toBe("v2026-graphql");
    expect(result.data.id).toBe(1614908485455733264);
    expect(result.data.title).toBe("Cozy Apartment in Skopje Center");
    expect(result.data.isSuperhost).toBe(true);
    expect(result.data.personCapacity).toBe(5);
    expect(result.data.rating.value).toBeCloseTo(4.9);
    expect(result.data.rating.reviewCount).toBe(19);
    expect(result.data.photos.length).toBeGreaterThan(0);
    expect(result.data.amenities.length).toBeGreaterThan(0);
    expect(result.data.host.name).toBe("Maja");
  });

  it("falls back to bare parser when shape is unknown and emits a warning", async () => {
    // An empty object has no id → bare fallback runs and warns it couldn't find an id.
    const result = await parseListing({});
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.parserVersion).toBe("bare");
    expect(result.warnings.some((w) => w.includes("id"))).toBe(true);
  });

  it("never returns an error envelope — bare parser always matches (graceful degradation)", async () => {
    // Even totally null input degrades to a bare parse with null fields, not a hard error.
    const result = await parseListing(null);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.parserVersion).toBe("bare");
    expect(result.data.id).toBeNull();
  });
});

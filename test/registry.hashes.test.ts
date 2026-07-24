import { describe, it, expect, vi, beforeEach } from "vitest";
import { PERSISTED_QUERIES, resolveHash, extensions, type OperationName } from "../src/registry/hashes.js";
import { setConfig } from "../src/config/load.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

// Mock the dynamic resolver
vi.mock("../src/registry/hashes-resolver.js", () => ({
  fetchStaysSearchHash: vi.fn().mockResolvedValue("dynamic-hash"),
}));

describe("hashes", () => {
  beforeEach(() => {
    setConfig(DEFAULT_CONFIG);
  });

  it("PERSISTED_QUERIES contains all operations", () => {
    expect(Object.keys(PERSISTED_QUERIES)).toEqual([
      "StaysSearch", "StaysPdpSections", "StaysPdpReviewsQuery", "PdpAvailabilityCalendar",
      "UserProfileBeehiveListingQuery", "GetUserProfile", "ExperiencesSearch",
    ]);
  });
  it("resolveHash returns static hash for non-StaysSearch", async () => {
    expect(await resolveHash("GetUserProfile")).toBe(PERSISTED_QUERIES.GetUserProfile);
  });
  it("resolveHash honors config overrides", async () => {
    const override = "b".repeat(64);
    setConfig({ ...DEFAULT_CONFIG, hashOverrides: { GetUserProfile: override } });
    expect(await resolveHash("GetUserProfile")).toBe(override);
  });
  it("resolveHash uses dynamic resolver for StaysSearch", async () => {
    expect(await resolveHash("StaysSearch")).toBe("dynamic-hash");
  });
  it("extensions builds persisted query envelope", () => {
    expect(extensions("StaysSearch", "abc")).toEqual({ persistedQuery: { version: 1, sha256Hash: "abc" } });
  });
});

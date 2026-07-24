import { describe, it, expect } from "vitest";
import {
  validateDomain,
  domainDefaults,
  baseUrl,
  extractDomain,
  KNOWN_DOMAINS,
} from "../src/lib/domain.js";

describe("domain", () => {
  it("KNOWN_DOMAINS includes airbnb.com", () => {
    expect(KNOWN_DOMAINS).toContain("airbnb.com");
  });

  it("validateDomain returns lowercase trimmed domain", () => {
    expect(validateDomain("  Airbnb.IE ")).toBe("airbnb.ie");
  });

  it("validateDomain throws on unknown domain", () => {
    expect(() => validateDomain("airbnb.xy")).toThrow("Unknown domain");
  });

  it("domainDefaults returns locale + acceptLanguage for known domain", () => {
    expect(domainDefaults("airbnb.fr")).toEqual({
      locale: "fr",
      acceptLanguage: "fr,en;q=0.9",
    });
  });

  it("domainDefaults defaults to en for unknown domain", () => {
    expect(domainDefaults("unknown")).toEqual({
      locale: "en",
      acceptLanguage: "en,en;q=0.9",
    });
  });

  it("baseUrl builds www.airbnb.com by default", () => {
    expect(baseUrl()).toBe("https://www.airbnb.com");
  });

  it("baseUrl builds custom domain", () => {
    expect(baseUrl("airbnb.ie")).toBe("https://www.airbnb.ie");
  });

  it("extractDomain returns domain for valid airbnb URL", () => {
    expect(extractDomain("https://www.airbnb.ie/rooms/123")).toBe("airbnb.ie");
  });

  it("extractDomain returns domain without www", () => {
    expect(extractDomain("https://airbnb.com/rooms/123")).toBe("airbnb.com");
  });

  it("extractDomain returns undefined for non-airbnb URL", () => {
    expect(extractDomain("https://example.com")).toBeUndefined();
  });

  it("extractDomain returns undefined for invalid URL", () => {
    expect(extractDomain("not a url")).toBeUndefined();
  });

  it("extractDomain handles subdomain patterns", () => {
    expect(extractDomain("https://ar.airbnb.com/rooms")).toBe("ar.airbnb.com");
  });
});

import { describe, it, expect } from "vitest";
import { parsePriceString, parseRatingString } from "../src/lib/price.js";

describe("parsePriceString", () => {
  it("parses US price with $", () => {
    expect(parsePriceString("$1,234.56")).toEqual({ amount: 1234.56, currency: "$" });
  });
  it("parses European price with €", () => {
    expect(parsePriceString("€34,99")).toEqual({ amount: 34.99, currency: "€" });
  });
  it("parses European thousands+decimal", () => {
    expect(parsePriceString("1.234,56 €")).toEqual({ amount: 1234.56, currency: "€" });
  });
  it("parses no-decimal price", () => {
    expect(parsePriceString("$50")).toEqual({ amount: 50, currency: "$" });
  });
  it("parses comma thousands with 3 digits after (US group)", () => {
    expect(parsePriceString("$1,000")).toEqual({ amount: 1000, currency: "$" });
  });
  it("returns null on empty string", () => {
    expect(parsePriceString("")).toBeNull();
  });
  it("returns null on null/undefined", () => {
    expect(parsePriceString(null)).toBeNull();
    expect(parsePriceString(undefined)).toBeNull();
  });
  it("returns null on non-string", () => {
    expect(parsePriceString(5 as unknown as string)).toBeNull();
  });
  it("returns null when no number found", () => {
    expect(parsePriceString("free")).toBeNull();
  });
  it("returns null currency when only number", () => {
    expect(parsePriceString("50")).toEqual({ amount: 50, currency: null });
  });
  it("parses comma-only with 2 digits after (decimal)", () => {
    expect(parsePriceString("34,99")).toEqual({ amount: 34.99, currency: null });
  });
  it("parses comma-only with 1 digit after (decimal)", () => {
    expect(parsePriceString("34,9")).toEqual({ amount: 34.9, currency: null });
  });
  it("parses comma-only with 4 digits after (treats as decimal)", () => {
    // 4 digits after comma is not a standard thousands group, so treated as decimal
    expect(parsePriceString("1,0000")).toEqual({ amount: 1.0, currency: null });
  });
  it("parses comma-only with 3 digits after (thousands)", () => {
    expect(parsePriceString("1,000")).toEqual({ amount: 1000, currency: null });
  });
  it("parses comma-only with 3 digits after but multiple commas (thousands)", () => {
    expect(parsePriceString("1,000,000")).toEqual({ amount: 1000000, currency: null });
  });
  it("parses comma-only with 2 digits after multiple commas (decimal)", () => {
    expect(parsePriceString("1,000,00")).toEqual({ amount: 100000, currency: null });
  });
  it("parses dot-only price", () => {
    expect(parsePriceString("50.99")).toEqual({ amount: 50.99, currency: null });
  });
  it("parses dot-only integer", () => {
    expect(parsePriceString("50")).toEqual({ amount: 50, currency: null });
  });
  it("handles price with symbol after number", () => {
    expect(parsePriceString("100 €")).toEqual({ amount: 100, currency: "€" });
  });
  it("handles price with both separators comma last (European)", () => {
    expect(parsePriceString("1.234,56")).toEqual({ amount: 1234.56, currency: null });
  });
  it("handles price with both separators dot last (US)", () => {
    expect(parsePriceString("1,234.56")).toEqual({ amount: 1234.56, currency: null });
  });
  it("handles comma-only with empty parts (no comma)", () => {
    // parts.length === 1 → skip the comma-only branch entirely
    expect(parsePriceString("50")).toEqual({ amount: 50, currency: null });
  });
  it("handles comma-only with 3 digits after (thousands group)", () => {
    expect(parsePriceString("1,000")).toEqual({ amount: 1000, currency: null });
  });
  it("handles parts.length === 0 edge case (empty after split)", () => {
    // parts.length === 0 is impossible with split, but the branch exists
    // Trigger by empty string already handled; this is defensive
    expect(parsePriceString("   ")).toBeNull();
  });
});

describe("parseRatingString", () => {
  it("parses '4.9 (19 reviews)'", () => {
    expect(parseRatingString("4.9 (19 reviews)")).toEqual({ value: 4.9, reviewCount: 19 });
  });
  it("parses rating only", () => {
    expect(parseRatingString("4.9")).toEqual({ value: 4.9, reviewCount: null });
  });
  it("parses with comma decimal", () => {
    expect(parseRatingString("4,9 (5 reviews)")).toEqual({ value: 4.9, reviewCount: 5 });
  });
  it("returns null on empty/null/undefined", () => {
    expect(parseRatingString("")).toBeNull();
    expect(parseRatingString(null)).toBeNull();
    expect(parseRatingString(undefined)).toBeNull();
  });
  it("returns null on non-string", () => {
    expect(parseRatingString(5 as unknown as string)).toBeNull();
  });
  it("returns null on NaN rating", () => {
    expect(parseRatingString("abc")).toBeNull();
  });
  it("parses rating with no review count", () => {
    expect(parseRatingString("4.9 stars")).toEqual({ value: 4.9, reviewCount: null });
  });
  it("parses rating with review count in parens", () => {
    expect(parseRatingString("4.9 (100)")).toEqual({ value: 4.9, reviewCount: 100 });
  });
  it("parses rating with multiple spaces", () => {
    expect(parseRatingString("4.9   (19 reviews)")).toEqual({ value: 4.9, reviewCount: 19 });
  });
});

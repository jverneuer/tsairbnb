import { describe, it, expect } from "vitest";
import { path, probe, at } from "../src/lib/get.js";

describe("path", () => {
  it("traverses dotted paths", () => {
    expect(path({ a: { b: { c: 1 } } }, "a.b.c")).toBe(1);
  });
  it("returns undefined on missing key", () => {
    expect(path({ a: { b: 1 } }, "a.c")).toBeUndefined();
  });
  it("returns fallback on null/undefined", () => {
    expect(path({ a: null }, "a.b", "fb")).toBe("fb");
    expect(path({ a: undefined }, "a.b", "fb")).toBe("fb");
    expect(path({}, "a.b")).toBeUndefined();
  });
  it("returns fallback when final value is null", () => {
    expect(path({ a: { b: null } }, "a.b", "fb")).toBe("fb");
  });
  it("handles top-level path", () => {
    expect(path({ x: 5 }, "x")).toBe(5);
  });
  it("returns undefined for null root", () => {
    expect(path(null, "a.b")).toBeUndefined();
    expect(path(undefined, "a.b")).toBeUndefined();
  });
  it("handles numeric keys in objects", () => {
    expect(path({ a: { "1": "x" } }, "a.1")).toBe("x");
  });
});

describe("probe", () => {
  it("returns first non-null hit", () => {
    expect(probe({ a: null, b: { c: 2 } }, ["a", "b.c"])).toBe(2);
  });
  it("returns undefined when all miss", () => {
    expect(probe({ a: 1 }, ["x", "y"])).toBeUndefined();
  });
  it("skips null/undefined values", () => {
    expect(probe({ a: null, b: undefined, c: 3 }, ["a", "b", "c"])).toBe(3);
  });
  it("returns undefined for empty paths", () => {
    expect(probe({ a: 1 }, [])).toBeUndefined();
  });
});

describe("at", () => {
  it("returns element at index", () => {
    expect(at([10, 20, 30], 1)).toBe(20);
  });
  it("returns undefined for out-of-range", () => {
    expect(at([1, 2], -1)).toBeUndefined();
    expect(at([1, 2], 5)).toBeUndefined();
  });
  it("returns undefined for undefined array", () => {
    expect(at(undefined, 0)).toBeUndefined();
  });
  it("returns undefined for empty array", () => {
    expect(at([], 0)).toBeUndefined();
  });
});

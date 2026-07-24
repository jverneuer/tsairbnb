import { describe, it, expect } from "vitest";
import { runParser, type ParserStrategy } from "../src/parsers/registry.js";

describe("runParser", () => {
  const strategies: ParserStrategy<string>[] = [
    { name: "a", detect: (raw) => raw === "a", parse: () => "parsed-a" },
    { name: "b", detect: (raw) => raw === "b", parse: () => "parsed-b" },
    { name: "bare", detect: () => true, parse: () => "parsed-bare" },
  ];

  it("returns first detect-match", () => {
    expect(runParser(strategies, "a")).toEqual({ data: "parsed-a", parserVersion: "a", warnings: [] });
    expect(runParser(strategies, "b")).toEqual({ data: "parsed-b", parserVersion: "b", warnings: [] });
  });
  it("falls through to bare when no prior match", () => {
    expect(runParser(strategies, "c")).toEqual({ data: "parsed-bare", parserVersion: "bare", warnings: [] });
  });
  it("falls through when detect throws", () => {
    const throwing: ParserStrategy<string>[] = [
      { name: "throws", detect: () => { throw new Error("boom"); }, parse: () => "x" },
      { name: "bare", detect: () => true, parse: () => "parsed-bare" },
    ];
    expect(runParser(throwing, "anything")).toEqual({ data: "parsed-bare", parserVersion: "bare", warnings: [] });
  });
  it("falls through when parse throws and records warning", () => {
    const throwing: ParserStrategy<string>[] = [
      { name: "parse-throws", detect: () => true, parse: () => { throw new Error("boom"); } },
      { name: "bare", detect: () => true, parse: () => "parsed-bare" },
    ];
    const result = runParser(throwing, "anything");
    expect(result).toEqual({ data: "parsed-bare", parserVersion: "bare", warnings: ["parse-throws: parse threw: boom"] });
  });
  it("returns error when no strategy matches and no bare", () => {
    const strict: ParserStrategy<string>[] = [
      { name: "a", detect: (raw) => raw === "a", parse: () => "x" },
    ];
    expect(runParser(strict, "z")).toEqual({ error: "no-strategy-matched" });
  });
  it("accumulates warnings from successful parse", () => {
    const warnStrategy: ParserStrategy<string>[] = [
      { name: "warn", detect: () => true, parse: (_raw, warnings) => { warnings.push("warn-msg"); return "ok"; } },
    ];
    expect(runParser(warnStrategy, "anything")).toEqual({ data: "ok", parserVersion: "warn", warnings: ["warn-msg"] });
  });
});

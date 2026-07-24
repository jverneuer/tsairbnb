import { describe, it, expect, beforeEach } from "vitest";
import { Config } from "../src/config/schema.js";
import { getConfig, setConfig, loadConfig, rotateUserAgent } from "../src/config/load.js";
import { DEFAULT_CONFIG, DEFAULT_USER_AGENTS } from "../src/config/defaults.js";

describe("Config schema", () => {
  it("accepts a valid config", () => {
    const parsed = Config.parse(DEFAULT_CONFIG);
    expect(parsed.userAgents.length).toBeGreaterThan(0);
  });
  it("applies defaults for optional fields", () => {
    const parsed = Config.parse({ userAgents: ["ua"] });
    expect(parsed.acceptLanguage).toBe("en-US,en;q=0.9");
    expect(parsed.currency).toBe("USD");
    expect(parsed.locale).toBe("en");
    expect(parsed.proxies).toEqual([]);
    expect(parsed.hashOverrides).toEqual({});
    expect(parsed.tlsProfile).toBe("chrome124");
    expect(parsed.timeoutMs).toBe(30_000);
    expect(parsed.maxPages).toBe(50);
    expect(parsed.itemsPerGrid).toBe(50);
  });
  it("rejects empty userAgents", () => {
    expect(() => Config.parse({ userAgents: [] })).toThrow();
  });
  it("rejects invalid hash override (not 64 hex)", () => {
    expect(() => Config.parse({ userAgents: ["ua"], hashOverrides: { StaysSearch: "abc" } })).toThrow();
  });
  it("accepts valid hash override", () => {
    const hash = "a".repeat(64);
    const parsed = Config.parse({ userAgents: ["ua"], hashOverrides: { StaysSearch: hash } });
    expect(parsed.hashOverrides["StaysSearch"]).toBe(hash);
  });
  it("rejects invalid tlsProfile", () => {
    expect(() => Config.parse({ userAgents: ["ua"], tlsProfile: "firefox" as any })).toThrow();
  });
});

describe("getConfig/setConfig/loadConfig", () => {
  beforeEach(() => {
    setConfig(DEFAULT_CONFIG);
  });

  it("getConfig returns current config", () => {
    expect(getConfig()).toBe(DEFAULT_CONFIG);
  });
  it("setConfig replaces current", () => {
    const next = { ...DEFAULT_CONFIG, locale: "mk" };
    setConfig(next);
    expect(getConfig().locale).toBe("mk");
  });
  it("loadConfig validates and sets", () => {
    const next = { ...DEFAULT_CONFIG, locale: "de" };
    const parsed = loadConfig(next);
    expect(parsed.locale).toBe("de");
    expect(getConfig().locale).toBe("de");
  });
  it("loadConfig throws on invalid input", () => {
    expect(() => loadConfig({ userAgents: [] })).toThrow();
  });
});

describe("rotateUserAgent", () => {
  beforeEach(() => {
    setConfig(DEFAULT_CONFIG);
    delete process.env.TSAIRBNB_UA_SEED;
  });

  it("picks deterministically by seed", () => {
    process.env.TSAIRBNB_UA_SEED = "0";
    expect(rotateUserAgent()).toBe(DEFAULT_USER_AGENTS[0]);
    process.env.TSAIRBNB_UA_SEED = "1";
    expect(rotateUserAgent()).toBe(DEFAULT_USER_AGENTS[1]);
  });
  it("wraps around via modulo", () => {
    process.env.TSAIRBNB_UA_SEED = String(DEFAULT_USER_AGENTS.length);
    expect(rotateUserAgent()).toBe(DEFAULT_USER_AGENTS[0]);
  });
  it("returns only element when pool size 1", () => {
    setConfig({ ...DEFAULT_CONFIG, userAgents: ["only"] });
    expect(rotateUserAgent()).toBe("only");
  });
});

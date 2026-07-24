import { describe, it, expect, beforeEach } from "vitest";
import { browserHeaders, graphqlHeaders, pickProxy } from "../src/http/headers.js";
import { setConfig } from "../src/config/load.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

describe("browserHeaders", () => {
  beforeEach(() => {
    setConfig(DEFAULT_CONFIG);
    delete process.env.TSAIRBNB_UA_SEED;
  });

  it("returns full nav headers with rotated UA", () => {
    process.env.TSAIRBNB_UA_SEED = "0";
    const h = browserHeaders();
    expect(h.Accept).toContain("text/html");
    expect(h["User-Agent"]).toBe(DEFAULT_CONFIG.userAgents[0]);
    expect(h["Sec-Fetch-Mode"]).toBe("navigate");
  });
  it("accepts custom language", () => {
    expect(browserHeaders("mk")["Accept-Language"]).toBe("mk");
  });
});

describe("graphqlHeaders", () => {
  beforeEach(() => {
    setConfig(DEFAULT_CONFIG);
    delete process.env.TSAIRBNB_UA_SEED;
  });

  it("returns JSON headers + api key", () => {
    process.env.TSAIRBNB_UA_SEED = "0";
    const h = graphqlHeaders("key123");
    expect(h.Accept).toBe("application/json");
    expect(h["Content-Type"]).toBe("application/json");
    expect(h["X-Airbnb-Api-Key"]).toBe("key123");
    expect(h["User-Agent"]).toBe(DEFAULT_CONFIG.userAgents[0]);
  });
});

describe("pickProxy", () => {
  beforeEach(() => {
    delete process.env.TSAIRBNB_PROXY_SEED;
  });

  it("returns undefined when no proxies", () => {
    setConfig({ ...DEFAULT_CONFIG, proxies: [] });
    expect(pickProxy()).toBeUndefined();
  });
  it("returns only proxy when pool size 1", () => {
    setConfig({ ...DEFAULT_CONFIG, proxies: ["http://p1"] });
    expect(pickProxy()).toBe("http://p1");
  });
  it("picks deterministically by seed", () => {
    setConfig({ ...DEFAULT_CONFIG, proxies: ["http://p1", "http://p2"] });
    process.env.TSAIRBNB_PROXY_SEED = "0";
    expect(pickProxy()).toBe("http://p1");
    process.env.TSAIRBNB_PROXY_SEED = "1";
    expect(pickProxy()).toBe("http://p2");
  });
  it("wraps via modulo", () => {
    setConfig({ ...DEFAULT_CONFIG, proxies: ["http://p1", "http://p2"] });
    process.env.TSAIRBNB_PROXY_SEED = "2";
    expect(pickProxy()).toBe("http://p1");
  });
  it("handles pool size 3", () => {
    setConfig({ ...DEFAULT_CONFIG, proxies: ["http://p1", "http://p2", "http://p3"] });
    process.env.TSAIRBNB_PROXY_SEED = "0";
    expect(pickProxy()).toBe("http://p1");
    process.env.TSAIRBNB_PROXY_SEED = "2";
    expect(pickProxy()).toBe("http://p3");
    process.env.TSAIRBNB_PROXY_SEED = "3";
    expect(pickProxy()).toBe("http://p1");
  });
  it("uses day-seed fallback when env unset", () => {
    setConfig({ ...DEFAULT_CONFIG, proxies: ["http://p1", "http://p2"] });
    delete process.env.TSAIRBNB_PROXY_SEED;
    expect(pickProxy()).toMatch(/^http:\/\/p[12]$/);
  });
});

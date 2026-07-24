import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchJson, buildMeta } from "../src/lib/fetch-json.js";
import { getClient, setClient } from "../src/http/curl-impersonate.js";
import { setConfig } from "../src/config/load.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

describe("fetchJson", () => {
  beforeEach(() => {
    setConfig(DEFAULT_CONFIG);
  });

  it("returns raw + meta on success", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ foo: "bar" }) }) } as any);
    const result = await fetchJson("http://x.com", {}, "test");
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.raw).toEqual({ foo: "bar" });
      expect(result.meta.endpoint).toBe("test");
    }
  });
  it("returns block on 403", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 403, body: "" }) } as any);
    const result = await fetchJson("http://x.com", {}, "test");
    expect(result).toEqual({ ok: false, error: "blocked: Airbnb returned 403 (TLS fingerprint likely flagged)", code: "block" });
  });
  it("returns error on non-2xx", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 500, body: "" }) } as any);
    const result = await fetchJson("http://x.com", {}, "test");
    expect(result).toEqual({ ok: false, error: "http 500", code: "http-500" });
  });
  it("returns error on non-JSON", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: "not json" }) } as any);
    const result = await fetchJson("http://x.com", {}, "test");
    expect(result).toEqual({ ok: false, error: "response was not JSON", code: "parse" });
  });
});

describe("buildMeta", () => {
  it("merges base + extra", () => {
    const meta = buildMeta(
      { fetchedAt: "t", durationMs: 5, endpoint: "ep" },
      { parserVersion: "v1", warnings: ["w"], mode: "live" },
    );
    expect(meta).toEqual({ fetchedAt: "t", durationMs: 5, endpoint: "ep", parserVersion: "v1", warnings: ["w"], mode: "live" });
  });
});

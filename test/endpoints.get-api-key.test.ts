import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getApiKey } from "../src/endpoints/get-api-key.js";
import { getClient, setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

describe("getApiKey", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("reprocess extracts key from raw", async () => {
    const result = await getApiKey({ mode: "reprocess", raw: 'prefix "api_config":{"key":"abc123"} suffix' });
    expect(result).toEqual({ ok: true, data: { apiKey: "abc123" }, raw: expect.any(String), meta: expect.any(Object) });
  });
  it("reprocess returns error when no key in raw", async () => {
    const result = await getApiKey({ mode: "reprocess", raw: "no key here" });
    expect(result).toEqual({ ok: false, error: "no api_config.key in raw", code: "parse" });
  });
  it("live scrapes homepage and extracts key", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: 'foo "api_config":{"key":"live_key"} bar' }) } as any);
    const result = await getApiKey({ mode: "live" });
    expect(result).toMatchObject({ ok: true, data: { apiKey: "live_key" } });
  });
  it("live returns error on non-200", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 500, body: "" }) } as any);
    const result = await getApiKey({ mode: "live" });
    expect(result).toEqual({ ok: false, error: "http 500", code: "http-500" });
  });
  it("omits respondedDomain when effectiveUrl is empty", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: 'foo "api_config":{"key":"k1"} bar', effectiveUrl: "" }) } as any);
    const result = await getApiKey({ mode: "live" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meta.respondedDomain).toBeUndefined();
      expect("respondedDomain" in result.meta).toBe(false);
    }
  });
  it("live returns error when no key on homepage", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: "no key" }) } as any);
    const result = await getApiKey({ mode: "live" });
    expect(result).toMatchObject({ ok: false, error: "no api_config.key on homepage", code: "parse" });
  });
});

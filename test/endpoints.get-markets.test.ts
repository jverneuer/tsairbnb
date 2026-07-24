import { describe, it, expect, vi, afterEach } from "vitest";
import { getMarkets } from "../src/endpoints/get-markets.js";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

describe("getMarkets", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("reprocess returns user_markets passthrough", async () => {
    const result = await getMarkets({ mode: "reprocess", raw: { user_markets: [{ id: 1 }] } });
    expect(result).toMatchObject({ ok: true, data: [{ id: 1 }] });
  });
  it("reprocess wraps non-array", async () => {
    const result = await getMarkets({ mode: "reprocess", raw: { user_markets: { id: 1 } } });
    expect(result).toMatchObject({ ok: true, data: [{ id: 1 }] });
  });
  it("reprocess falls back to raw when no user_markets key", async () => {
    const result = await getMarkets({ mode: "reprocess", raw: { foo: "bar" } });
    expect(result).toMatchObject({ ok: true, data: [{ foo: "bar" }] });
  });
  it("live fetches and returns markets", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ user_markets: [{ id: 1 }, { id: 2 }] }) }) } as any);
    const result = await getMarkets({ mode: "live", apiKey: "k" });
    expect(result).toMatchObject({ ok: true, data: [{ id: 1 }, { id: 2 }] });
  });
  it("live returns block on 403", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 403, body: "" }) } as any);
    const result = await getMarkets({ mode: "live", apiKey: "k" });
    expect(result).toEqual({ ok: false, error: "blocked: 403", code: "block" });
  });
  it("live returns error on non-200", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 500, body: "" }) } as any);
    const result = await getMarkets({ mode: "live", apiKey: "k" });
    expect(result).toEqual({ ok: false, error: "http 500", code: "http-500" });
  });
  it("live returns error on non-JSON", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: "not json" }) } as any);
    const result = await getMarkets({ mode: "live", apiKey: "k" });
    expect(result).toEqual({ ok: false, error: "not JSON", code: "parse" });
  });
  it("live wraps non-array user_markets in array", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { user_markets: "x" } }) }) } as any);
    const result = await getMarkets({ mode: "live", apiKey: "k" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(["x"]);
  });
  it("live includes respondedDomain in meta when effectiveUrl present", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ user_markets: [] }), effectiveUrl: "https://www.airbnb.com/api/v2/user_markets" }) } as any);
    const result = await getMarkets({ mode: "live", apiKey: "k" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.meta).toHaveProperty("respondedDomain", "airbnb.com");
  });
  it("live omits respondedDomain from meta when effectiveUrl absent", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ user_markets: [] }) }) } as any);
    const result = await getMarkets({ mode: "live", apiKey: "k" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.meta).not.toHaveProperty("respondedDomain");
  });
  it("live falls back to raw when user_markets missing", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: {} }) }) } as any);
    const result = await getMarkets({ mode: "live", apiKey: "k" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([{ data: {} }]);
  });
});

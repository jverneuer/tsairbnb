import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchStaysSearchHashEndpoint } from "../src/endpoints/fetch-stays-search-hash.js";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

describe("fetchStaysSearchHashEndpoint", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("reprocess extracts hash from raw string", async () => {
    const result = await fetchStaysSearchHashEndpoint({ mode: "reprocess", raw: "abc123hash" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.hash).toBe("abc123hash");
  });
  it("reprocess extracts hash from raw object", async () => {
    const result = await fetchStaysSearchHashEndpoint({ mode: "reprocess", raw: { data: { niobeClientData: [[null, { operationId: "h1" }]] } } });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.hash).toBe("h1");
  });
  it("reprocess returns error when no hash", async () => {
    const result = await fetchStaysSearchHashEndpoint({ mode: "reprocess", raw: {} });
    expect(result).toEqual({ ok: false, error: "no hash in raw", code: "parse" });
  });
  it("live resolves dynamic hash", async () => {
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      if (req.url === "https://www.airbnb.com") return Promise.resolve({ status: 200, body: 'https://a0.muscache.com/airbnb/static/packages/web/en/frontend/airmetro/browser/asyncRequire.abc.js' });
      if (req.url.includes("asyncRequire")) return Promise.resolve({ status: 200, body: 'common/frontend/stays-search/routes/StaysSearchRoute/StaysSearchRoute.prepare.abc.js' });
      return Promise.resolve({ status: 200, body: 'name:"StaysSearch" sha256Hash:"' + "a".repeat(64) + '"' });
    }) } as any);
    const result = await fetchStaysSearchHashEndpoint({ mode: "live" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.source).toBe("dynamic");
  });
  it("live falls back to static on failure", async () => {
    setClient({ request: vi.fn().mockRejectedValue(new Error("network")) } as any);
    const result = await fetchStaysSearchHashEndpoint({ mode: "live" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.source).toBe("static");
  });
});

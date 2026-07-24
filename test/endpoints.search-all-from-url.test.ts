import { describe, it, expect, vi, afterEach } from "vitest";
import { searchAllFromUrl } from "../src/endpoints/search-all-from-url.js";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

// Mock dynamic StaysSearch hash resolver to avoid webpack scraping
vi.mock("../src/registry/hashes-resolver.js", () => ({
  fetchStaysSearchHash: vi.fn().mockResolvedValue("a".repeat(64)),
}));

describe("searchAllFromUrl", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("reprocess parses raw search results", async () => {
    const raw = { data: { presentation: { staysSearch: { results: { searchResults: [{ __typename: "StaySearchResult", title: "T" }] } } } } };
    const result = await searchAllFromUrl({ mode: "reprocess", raw });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.length).toBe(1);
  });
  it("reprocess returns empty data on unparseable input (bare fallback)", async () => {
    const result = await searchAllFromUrl({ mode: "reprocess", raw: { invalid: true } });
    expect(result).toMatchObject({ ok: true, data: [] });
  });
  it("reprocess returns error when parseSearch fails", async () => {
    vi.resetModules();
    vi.doMock("../src/parsers/search.js", () => ({
      parseSearch: async () => ({ error: "no-strategy-matched" }),
    }));
    const { searchAllFromUrl: mockedSearch } = await import("../src/endpoints/search-all-from-url.js");
    const result = await mockedSearch({ mode: "reprocess", raw: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("no-strategy-matched");
      expect(result.code).toBe("no-strategy-matched");
    }
    vi.doUnmock("../src/parsers/search.js");
  });
  it("live parses Airbnb URL and delegates to searchAll", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { presentation: { staysSearch: { results: { searchResults: [] } } } } }) }) } as any);
    const result = await searchAllFromUrl({ mode: "live", url: "https://www.airbnb.com/s/Skopje?check_in=2026-07-01&check_out=2026-07-05&adults=2", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live passes URL params to variables", async () => {
    let capturedUrl = "";
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      if (req.url.includes("StaysSearch")) capturedUrl = req.url;
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { staysSearch: { results: { searchResults: [] } } } } }) });
    }) } as any);
    await searchAllFromUrl({ mode: "live", url: "https://www.airbnb.com/s/Skopje?check_in=2026-07-01&price_min=50&price_max=200", apiKey: "k" });
    expect(capturedUrl).toBeDefined();
  });
  it("live parses all URL search params", async () => {
    let capturedBody = "";
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      if (req.url.includes("StaysSearch")) capturedBody = req.body ?? "";
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { staysSearch: { results: { searchResults: [] } } } } }) });
    }) } as any);
    await searchAllFromUrl({
      mode: "live",
      url: "https://www.airbnb.com/s/Skopje?check_in=2026-07-01&check_out=2026-07-05&ne_lat=42.0&ne_lng=21.5&sw_lat=41.9&sw_lng=21.3&zoom=12&price_min=50&price_max=200&adults=2&children=1&infants=0",
      apiKey: "k",
    });
    const vars = JSON.parse(capturedBody);
    const req = vars.variables.staysSearchRequest;
    expect(req.checkIn).toBe("2026-07-01");
    expect(req.checkOut).toBe("2026-07-05");
    expect(req.neLat).toBe(42);
    expect(req.neLng).toBe(21.5);
    expect(req.swLat).toBe(41.9);
    expect(req.swLng).toBe(21.3);
    expect(req.zoomValue).toBe(12);
    expect(req.priceMin).toBe(50);
    expect(req.priceMax).toBe(200);
    expect(req.adults).toBe(2);
    expect(req.children).toBe(1);
    expect(req.infants).toBe(0);
  });
  it("live handles URL with no search params", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { presentation: { staysSearch: { results: { searchResults: [] } } } } }) }) } as any);
    const result = await searchAllFromUrl({ mode: "live", url: "https://www.airbnb.com/s/Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live passes currency and language to searchAll", async () => {
    let capturedUrl = "";
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      if (req.url.includes("StaysSearch")) capturedUrl = req.url;
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { staysSearch: { results: { searchResults: [] } } } } }) });
    }) } as any);
    await searchAllFromUrl({ mode: "live", url: "https://www.airbnb.com/s/Skopje", apiKey: "k", currency: "EUR", language: "mk" });
    expect(capturedUrl).toContain("currency=EUR");
    expect(capturedUrl).toContain("locale=mk");
  });

  it("live forwards domain to baseUrl", async () => {
    let capturedUrl = "";
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      if (req.url.includes("StaysSearch")) capturedUrl = req.url;
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { staysSearch: { results: { searchResults: [] } } } } }) });
    }) } as any);
    await searchAllFromUrl({ mode: "live", url: "https://www.airbnb.com/s/Skopje", apiKey: "k", domain: "airbnb.ie" });
    expect(capturedUrl).toContain("www.airbnb.ie/");
  });

  it("live propagates HTTP errors from searchAll", async () => {
    setClient({ request: vi.fn().mockRejectedValue(new Error("network timeout")) } as any);
    await expect(searchAllFromUrl({ mode: "live", url: "https://www.airbnb.com/s/Skopje", apiKey: "k" })).rejects.toThrow("network timeout");
  });

  it("live non-numeric URL params produce NaN in variables", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      if (req.url.includes("StaysSearch")) { capturedUrl = req.url; capturedBody = req.body ?? ""; }
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { staysSearch: { results: { searchResults: [] } } } } }) });
    }) } as any);
    await searchAllFromUrl({ mode: "live", url: "https://www.airbnb.com/s/Skopje?ne_lat=abc&price_min=xyz", apiKey: "k" });
    // Variables are NaN in-memory but JSON.stringify(NaN) → null, so check URL query param which is stringified too
    const urlVars = JSON.parse(new URL(capturedUrl).searchParams.get("variables")!);
    expect(urlVars.staysSearchRequest.neLat).toBeNull();
    expect(urlVars.staysSearchRequest.priceMin).toBeNull();
  });

  it("live URL with missing params omits those fields", async () => {
    let capturedBody = "";
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      if (req.url.includes("StaysSearch")) capturedBody = req.body ?? "";
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { staysSearch: { results: { searchResults: [] } } } } }) });
    }) } as any);
    await searchAllFromUrl({ mode: "live", url: "https://www.airbnb.com/s/Skopje?check_in=2026-08-01", apiKey: "k" });
    const vars = JSON.parse(capturedBody);
    const req = vars.variables.staysSearchRequest;
    expect(req.checkIn).toBe("2026-08-01");
    expect(req.checkOut).toBeUndefined();
    expect(req.neLat).toBeUndefined();
    expect(req.priceMin).toBeUndefined();
  });
});

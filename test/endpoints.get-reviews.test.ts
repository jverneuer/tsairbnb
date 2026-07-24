import { describe, it, expect, vi, afterEach } from "vitest";
import { getReviews } from "../src/endpoints/get-reviews.js";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

describe("getReviews", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("reprocess parses raw reviews", async () => {
    const raw = { data: { presentation: { stayProductDetailPage: { reviews: { reviews: [{ id: "r1", ratingLocalized: "5.0" }] } } } } };
    const result = await getReviews({ mode: "reprocess", raw });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.length).toBe(1);
  });
  it("live fetches reviews via graphql", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { presentation: { stayProductDetailPage: { reviews: { reviews: [] } } } } }) }) } as any);
    const result = await getReviews({ mode: "live", roomUrl: "http://x.com", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live returns block on 403", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 403, body: "" }) } as any);
    const result = await getReviews({ mode: "live", roomUrl: "http://x.com", apiKey: "k" });
    expect(result).toMatchObject({ ok: false, code: "block" });
  });
  it("live returns error on non-2xx", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 500, body: "" }) } as any);
    const result = await getReviews({ mode: "live", roomUrl: "http://x.com", apiKey: "k" });
    expect(result).toMatchObject({ ok: false, code: "http-500" });
  });
  it("live stops pagination when fewer than LIMIT items returned", async () => {
    let callCount = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { stayProductDetailPage: { reviews: { reviews: [{ id: "r1" }, { id: "r2" }] } } } } }) });
    }) } as any);
    const result = await getReviews({ mode: "live", roomUrl: "http://x.com", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.length).toBe(2);
    expect(callCount).toBe(1);
  });
  it("live continues pagination when LIMIT items returned", async () => {
    let callCount = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callCount++;
      const count = callCount <= 2 ? 50 : 10;
      const reviews = Array.from({ length: count }, (_, i) => ({ id: `r${i}` }));
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { stayProductDetailPage: { reviews: { reviews } } } } }) });
    }) } as any);
    const result = await getReviews({ mode: "live", roomUrl: "http://x.com", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.length).toBe(110);
    expect(callCount).toBe(3);
  });
});

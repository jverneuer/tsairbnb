import { describe, it, expect, vi, afterEach } from "vitest";
import { getPrice } from "../src/endpoints/get-price.js";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

describe("getPrice", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("reprocess parses raw price", async () => {
    const raw = { data: { presentation: { stayProductDetailPage: { sections: { sections: [{ sectionId: "BOOK_IT_SIDEBAR", structuredDisplayPrice: { primaryLine: { price: "$100" } } }] } } } } };
    const result = await getPrice({ mode: "reprocess", raw });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.main.price).toEqual({ amount: 100, currency: "$" });
  });
  it("live fetches price via graphql", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { presentation: { stayProductDetailPage: { sections: { sections: [] } } } } }) }) } as any);
    const result = await getPrice({ mode: "live", roomId: "1", checkIn: "2026-07-01", checkOut: "2026-07-05", apiKey: "k", impressionId: "imp1" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live returns block on 403", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 403, body: "" }) } as any);
    const result = await getPrice({ mode: "live", roomId: "1", checkIn: "2026-07-01", checkOut: "2026-07-05", apiKey: "k", impressionId: "imp1" });
    expect(result).toMatchObject({ ok: false, code: "block" });
  });
});

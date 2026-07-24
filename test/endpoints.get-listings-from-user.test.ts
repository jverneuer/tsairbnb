import { describe, it, expect, vi, afterEach } from "vitest";
import { getListingsFromUser } from "../src/endpoints/get-listings-from-user.js";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

describe("getListingsFromUser", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("reprocess parses raw listings", async () => {
    const raw = { data: { beehive: { getListOfListings: { listings: [{ id: 1 }, { id: 2 }] } } } };
    const result = await getListingsFromUser({ mode: "reprocess", raw });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.data.listings.length).toBe(2);
      expect(result.data.count).toBe(2);
    }
  });
  it("live fetches listings via graphql", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { beehive: { getListOfListings: { listings: [] } } } }) }) } as any);
    const result = await getListingsFromUser({ mode: "live", hostId: "42", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live returns block on 403", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 403, body: "" }) } as any);
    const result = await getListingsFromUser({ mode: "live", hostId: "42", apiKey: "k" });
    expect(result).toMatchObject({ ok: false, code: "block" });
  });
  it("live stops pagination when count < LIMIT", async () => {
    let callCount = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { beehive: { getListOfListings: { listings: [{ id: 1 }], count: 1 } } } }) });
    }) } as any);
    const result = await getListingsFromUser({ mode: "live", hostId: "42", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.data.listings.length).toBe(1);
      expect(result.data.count).toBe(1);
    }
    expect(callCount).toBe(1);
  });
  it("live continues pagination when count == LIMIT", async () => {
    let callCount = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callCount++;
      const count = callCount <= 2 ? 1000 : 200;
      const listings = Array.from({ length: count }, (_, i) => ({ id: i }));
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { beehive: { getListOfListings: { listings, count } } } }) });
    }) } as any);
    const result = await getListingsFromUser({ mode: "live", hostId: "42", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.listings.length).toBe(2200);
    expect(callCount).toBe(3);
  });
});

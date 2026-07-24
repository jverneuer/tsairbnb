import { describe, it, expect, vi, afterEach } from "vitest";
import { getPlacesIds } from "../src/endpoints/get-places-ids.js";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

describe("getPlacesIds", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("reprocess returns autocomplete_terms passthrough", async () => {
    const result = await getPlacesIds({ mode: "reprocess", raw: { autocomplete_terms: [{ id: 1 }] } });
    expect(result).toMatchObject({ ok: true, data: [{ id: 1 }] });
  });
  it("reprocess wraps non-array", async () => {
    const result = await getPlacesIds({ mode: "reprocess", raw: { autocomplete_terms: { id: 1 } } });
    expect(result).toMatchObject({ ok: true, data: [{ id: 1 }] });
  });
  it("live fetches and returns places", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ autocomplete_terms: [{ id: 1 }] }) }) } as any);
    const result = await getPlacesIds({ mode: "live", country: "mk", locationName: "Skopje", apiKey: "k", configToken: "ct" });
    expect(result).toMatchObject({ ok: true, data: [{ id: 1 }] });
  });
  it("live returns block on 403", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 403, body: "" }) } as any);
    const result = await getPlacesIds({ mode: "live", country: "mk", locationName: "Skopje", apiKey: "k", configToken: "ct" });
    expect(result).toEqual({ ok: false, error: "blocked: 403", code: "block" });
  });
  it("live returns error on non-200", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 500, body: "" }) } as any);
    const result = await getPlacesIds({ mode: "live", country: "mk", locationName: "Skopje", apiKey: "k", configToken: "ct" });
    expect(result).toEqual({ ok: false, error: "http 500", code: "http-500" });
  });
  it("live returns error on non-JSON", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: "not json" }) } as any);
    const result = await getPlacesIds({ mode: "live", country: "mk", locationName: "Skopje", apiKey: "k", configToken: "ct" });
    expect(result).toEqual({ ok: false, error: "not JSON", code: "parse" });
  });
  it("live wraps non-array autocomplete_terms in array", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { autocomplete_terms: "x" } }) }) } as any);
    const result = await getPlacesIds({ mode: "live", country: "mk", locationName: "Skopje", apiKey: "k", configToken: "ct" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(["x"]);
  });
  it("live falls back to raw when autocomplete_terms missing", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: {} }) }) } as any);
    const result = await getPlacesIds({ mode: "live", country: "mk", locationName: "Skopje", apiKey: "k", configToken: "ct" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([{ data: {} }]);
  });
  it("live reprocess falls back to raw when no autocomplete_terms key", async () => {
    const result = await getPlacesIds({ mode: "reprocess", raw: { foo: "bar" } });
    expect(result).toMatchObject({ ok: true, data: [{ foo: "bar" }] });
  });
  it("live includes respondedDomain in meta when effectiveUrl present", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ autocomplete_terms: [{ id: 1 }] }), effectiveUrl: "https://www.airbnb.com/api/..." }) } as any);
    const result = await getPlacesIds({ mode: "live", country: "mk", locationName: "Skopje", apiKey: "k", configToken: "ct" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.meta.respondedDomain).toBe("airbnb.com");
  });
  it("live omits respondedDomain from meta when effectiveUrl absent", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ autocomplete_terms: [{ id: 1 }] }) }) } as any);
    const result = await getPlacesIds({ mode: "live", country: "mk", locationName: "Skopje", apiKey: "k", configToken: "ct" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.meta).not.toHaveProperty("respondedDomain");
  });
});

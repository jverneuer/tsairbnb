import { describe, it, expect, vi, afterEach } from "vitest";
import { experienceSearchByPlaceId } from "../src/endpoints/experience-search-by-place-id.js";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

describe("experienceSearchByPlaceId", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("reprocess parses raw experience results", async () => {
    const raw = { data: { presentation: { experiencesSearch: { results: { searchResults: [{ id: "e1", title: "Tour" }] } } } } };
    const result = await experienceSearchByPlaceId({ mode: "reprocess", raw });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.hits.length).toBe(1);
  });
  it("live fetches experiences via graphql POST", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { presentation: { experiencesSearch: { results: { searchResults: [] } } } } }) }) } as any);
    const result = await experienceSearchByPlaceId({ mode: "live", placeId: "p1", locationName: "Skopje", currency: "USD", locale: "en", checkIn: "2026-07-01", checkOut: "2026-07-05", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live returns block on 403", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 403, body: "" }) } as any);
    const result = await experienceSearchByPlaceId({ mode: "live", placeId: "p1", locationName: "Skopje", currency: "USD", locale: "en", checkIn: "2026-07-01", checkOut: "2026-07-05", apiKey: "k" });
    expect(result).toMatchObject({ ok: false, code: "block" });
  });
  it("live passes undefined for missing optional fields (cursor/checkIn/checkOut)", async () => {
    let capturedBody = "";
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      capturedBody = req.body ?? "";
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { experiencesSearch: { results: { searchResults: [] } } } } }) });
    }) } as any);
    await experienceSearchByPlaceId({ mode: "live", placeId: "p1", locationName: "Skopje", currency: "USD", locale: "en", apiKey: "k" });
    const vars = JSON.parse(capturedBody);
    expect(vars.variables.request.cursor).toBeUndefined();
    expect(vars.variables.request.checkIn).toBeUndefined();
    expect(vars.variables.request.checkOut).toBeUndefined();
  });
  it("live passes cursor when provided", async () => {
    let capturedBody = "";
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      capturedBody = req.body ?? "";
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { experiencesSearch: { results: { searchResults: [] } } } } }) });
    }) } as any);
    await experienceSearchByPlaceId({ mode: "live", placeId: "p1", locationName: "Skopje", currency: "USD", locale: "en", checkIn: "2026-07-01", checkOut: "2026-07-05", apiKey: "k", cursor: "abc" });
    const vars = JSON.parse(capturedBody);
    expect(vars.variables.request.cursor).toBe("abc");
  });
});

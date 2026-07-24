import { describe, it, expect, vi, afterEach } from "vitest";
import { experienceSearch } from "../src/endpoints/experience-search.js";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

describe("experienceSearch", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("reprocess parses raw experience results", async () => {
    const raw = { data: { presentation: { experiencesSearch: { results: { searchResults: [{ id: "e1", title: "Tour" }] } } } } };
    const result = await experienceSearch({ mode: "reprocess", raw });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.length).toBe(1);
  });
  it("reprocess returns empty data on unparseable input (bare fallback)", async () => {
    const result = await experienceSearch({ mode: "reprocess", raw: { invalid: true } });
    expect(result).toMatchObject({ ok: true, data: [] });
  });
  it("live orchestrates markets -> places -> search", async () => {
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      callIdx++;
      if (req.url.includes("user_markets")) return Promise.resolve({ status: 200, body: JSON.stringify({ user_markets: [{ satori_parameters: "sp", country_code: "mk" }] }) });
      if (req.url.includes("autocompletes")) return Promise.resolve({ status: 200, body: JSON.stringify({ autocomplete_terms: [{ location: { google_place_id: "p1", location_name: "Skopje" } }] }) });
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { experiencesSearch: { results: { searchResults: [] } } } } }) });
    }) } as any);
    const result = await experienceSearch({ mode: "live", userInputText: "Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live returns error when no markets", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ user_markets: [] }) }) } as any);
    const result = await experienceSearch({ mode: "live", userInputText: "Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: false, error: "no markets returned" });
  });
  it("live returns error when market missing satori_parameters", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ user_markets: [{ country_code: "mk" }] }) }) } as any);
    const result = await experienceSearch({ mode: "live", userInputText: "Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: false, error: "market missing satori_parameters or country_code" });
  });
  it("live returns error when no places", async () => {
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: JSON.stringify({ user_markets: [{ satori_parameters: "sp", country_code: "mk" }] }) });
      return Promise.resolve({ status: 200, body: JSON.stringify({ autocomplete_terms: [] }) });
    }) } as any);
    const result = await experienceSearch({ mode: "live", userInputText: "Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: false, error: "no places returned" });
  });
  it("live returns error when place missing google_place_id", async () => {
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: JSON.stringify({ user_markets: [{ satori_parameters: "sp", country_code: "mk" }] }) });
      return Promise.resolve({ status: 200, body: JSON.stringify({ autocomplete_terms: [{ location: { location_name: "Skopje" } }] }) });
    }) } as any);
    const result = await experienceSearch({ mode: "live", userInputText: "Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: false, error: "place missing google_place_id" });
  });
  it("live returns error when markets call fails", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 500, body: "" }) } as any);
    const result = await experienceSearch({ mode: "live", userInputText: "Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: false });
  });
  it("live returns error when places call fails", async () => {
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: JSON.stringify({ user_markets: [{ satori_parameters: "sp", country_code: "mk" }] }) });
      return Promise.resolve({ status: 500, body: "" });
    }) } as any);
    const result = await experienceSearch({ mode: "live", userInputText: "Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: false });
  });
  it("live returns error when experience search call fails", async () => {
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: JSON.stringify({ user_markets: [{ satori_parameters: "sp", country_code: "mk" }] }) });
      if (callIdx === 2) return Promise.resolve({ status: 200, body: JSON.stringify({ autocomplete_terms: [{ location: { google_place_id: "p1", location_name: "Skopje" } }] }) });
      return Promise.resolve({ status: 500, body: "" });
    }) } as any);
    const result = await experienceSearch({ mode: "live", userInputText: "Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: false });
  });
  it("live paginates through multiple pages", async () => {
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: JSON.stringify({ user_markets: [{ satori_parameters: "sp", country_code: "mk" }] }) });
      if (callIdx === 2) return Promise.resolve({ status: 200, body: JSON.stringify({ autocomplete_terms: [{ location: { google_place_id: "p1", location_name: "Skopje" } }] }) });
      if (callIdx === 3) return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { experiencesSearch: { results: { searchResults: [{ id: "e1" }], paginationInfo: { nextPageCursor: "c1" } } } } } }) });
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { experiencesSearch: { results: { searchResults: [{ id: "e2" }] } } } } }) });
    }) } as any);
    const result = await experienceSearch({ mode: "live", userInputText: "Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.length).toBe(2);
  });
  it("live uses configToken fallback for satori_parameters", async () => {
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: JSON.stringify({ user_markets: [{ configToken: "ct", countryCode: "mk" }] }) });
      if (callIdx === 2) return Promise.resolve({ status: 200, body: JSON.stringify({ autocomplete_terms: [{ google_place_id: "p1", location_name: "Skopje" }] }) });
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { experiencesSearch: { results: { searchResults: [] } } } } }) });
    }) } as any);
    const result = await experienceSearch({ mode: "live", userInputText: "Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live uses countryCode fallback for country_code", async () => {
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: JSON.stringify({ user_markets: [{ satori_parameters: "sp", countryCode: "mk" }] }) });
      if (callIdx === 2) return Promise.resolve({ status: 200, body: JSON.stringify({ autocomplete_terms: [{ location: { google_place_id: "p1", location_name: "Skopje" } }] }) });
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { experiencesSearch: { results: { searchResults: [] } } } } }) });
    }) } as any);
    const result = await experienceSearch({ mode: "live", userInputText: "Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live uses google_place_id fallback from place root", async () => {
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: JSON.stringify({ user_markets: [{ satori_parameters: "sp", country_code: "mk" }] }) });
      if (callIdx === 2) return Promise.resolve({ status: 200, body: JSON.stringify({ autocomplete_terms: [{ google_place_id: "p1", location_name: "Skopje" }] }) });
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { experiencesSearch: { results: { searchResults: [] } } } } }) });
    }) } as any);
    const result = await experienceSearch({ mode: "live", userInputText: "Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live uses location_name fallback from place root", async () => {
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: JSON.stringify({ user_markets: [{ satori_parameters: "sp", country_code: "mk" }] }) });
      if (callIdx === 2) return Promise.resolve({ status: 200, body: JSON.stringify({ autocomplete_terms: [{ location: { google_place_id: "p1" }, location_name: "Skopje" }] }) });
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { experiencesSearch: { results: { searchResults: [] } } } } }) });
    }) } as any);
    const result = await experienceSearch({ mode: "live", userInputText: "Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live handles markets returning non-array data", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ user_markets: "not-array" }) }) } as any);
    const result = await experienceSearch({ mode: "live", userInputText: "Skopje", apiKey: "k" });
    expect(result).toMatchObject({ ok: false });
  });
});

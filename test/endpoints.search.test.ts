import { describe, it, expect, vi, afterEach } from "vitest";
import { searchAll } from "../src/endpoints/search-all.js";
import { searchFirstPage } from "../src/endpoints/search-first-page.js";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

// Mock dynamic StaysSearch hash resolver
vi.mock("../src/registry/hashes-resolver.js", () => ({
  fetchStaysSearchHash: vi.fn().mockResolvedValue("a".repeat(64)),
}));

describe("searchAll / searchFirstPage", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("searchFirstPage reprocess parses raw search results", async () => {
    const raw = { data: { presentation: { staysSearch: { results: { searchResults: [{ __typename: "StaySearchResult", title: "Apt" }] } } } } };
    const result = await searchFirstPage({ mode: "reprocess", raw });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.hits.length).toBe(1);
  });
  it("searchFirstPage live fetches via graphql POST", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { presentation: { staysSearch: { results: { searchResults: [] } } } } }) }) } as any);
    const result = await searchFirstPage({ mode: "live", apiKey: "k", variables: {} });
    expect(result).toMatchObject({ ok: true });
  });
  it("searchAll reprocess parses raw", async () => {
    const raw = { data: { presentation: { staysSearch: { results: { searchResults: [] } } } } };
    const result = await searchAll({ mode: "reprocess", raw });
    expect(result).toMatchObject({ ok: true });
  });
  it("searchAll live paginates via cursor", async () => {
    let callCount = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { staysSearch: { results: { searchResults: [{ __typename: "StaySearchResult", title: "T" }], paginationInfo: { nextPageCursor: "c1" } } } } } }) });
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: { presentation: { staysSearch: { results: { searchResults: [{ __typename: "StaySearchResult", title: "T2" }] } } } } }) });
    }) } as any);
    const result = await searchAll({ mode: "live", apiKey: "k", variables: {} });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.length).toBe(2);
  });
  it("searchAll returns block on 403", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 403, body: "" }) } as any);
    const result = await searchAll({ mode: "live", apiKey: "k", variables: {} });
    expect(result).toMatchObject({ ok: false, code: "block" });
  });
});

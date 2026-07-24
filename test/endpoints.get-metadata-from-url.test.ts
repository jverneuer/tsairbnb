import { describe, it, expect, vi, afterEach } from "vitest";
import { getMetadataFromUrl, type Metadata } from "../src/endpoints/get-metadata-from-url.js";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

describe("getMetadataFromUrl", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("reprocess parses html and extracts metadata", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"foo":"bar"}]}</div>"language":"en""key":"k1""p3ImpressionId":"imp1""productId":"prod1"';
    const result = await getMetadataFromUrl({ mode: "reprocess", raw: { html } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.language).toBe("en");
      expect((result.data as any).priceInput.apiKey).toBe("k1");
      expect((result.data as any).priceInput.impressionId).toBe("imp1");
      expect((result.data as any).priceInput.productId).toBe("prod1");
    }
  });
  it("reprocess warns when no deferred-state blob", async () => {
    const result = await getMetadataFromUrl({ mode: "reprocess", raw: { html: "no blob" } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.meta.warnings.some((w) => w.includes("no #data-deferred-state-0"))).toBe(true);
  });
  it("live scrapes url and returns metadata", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"x":1}]}</div>"language":"mk""key":"k2"';
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: html, cookies: { c: "1" } }) } as any);
    const result = await getMetadataFromUrl({ mode: "live", roomUrl: "http://airbnb.com/rooms/1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.cookies).toEqual({ c: "1" });
      expect(result.data.language).toBe("mk");
    }
  });
  it("live returns block on 403", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 403, body: "" }) } as any);
    const result = await getMetadataFromUrl({ mode: "live", roomUrl: "http://x.com" });
    expect(result).toEqual({ ok: false, error: "blocked: 403", code: "block" });
  });
  it("live returns error on non-200", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 500, body: "" }) } as any);
    const result = await getMetadataFromUrl({ mode: "live", roomUrl: "http://x.com" });
    expect(result).toEqual({ ok: false, error: "http 500", code: "http-500" });
  });
  it("live warns when niobe JSON parse fails", async () => {
    const html = '<div id="data-deferred-state-0">{invalid json}</div>';
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: html, cookies: {} }) } as any);
    const result = await getMetadataFromUrl({ mode: "live", roomUrl: "http://x.com" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.meta.warnings.some((w) => w.includes("niobe parse failed"))).toBe(true);
  });
});

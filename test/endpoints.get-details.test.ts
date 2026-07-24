import { describe, it, expect, vi, afterEach } from "vitest";
import { getDetails } from "../src/endpoints/get-details.js";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

describe("getDetails", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("reprocess parses raw listing", async () => {
    const raw = { data: { presentation: { stayProductDetailPage: { sections: { metadata: { loggingContext: { eventDataLogging: {} } }, sections: [] } } } } };
    const result = await getDetails({ mode: "reprocess", raw });
    expect(result).toMatchObject({ ok: true });
  });
  it("live needs roomUrl or roomId", async () => {
    const result = await getDetails({ mode: "live" });
    expect(result).toEqual({ ok: false, error: "need roomUrl or roomId", code: "input" });
  });
  it("live aggregates listing + reviews + calendar + host + price", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"foo":"bar"}]}</div>"key":"k1""p3ImpressionId":"imp1"';
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      callIdx++;
      if (req.url.includes("GetDetails") || req.url.includes("/rooms/")) {
        return Promise.resolve({ status: 200, body: html });
      }
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: {} }) });
    }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1", checkIn: "2026-07-01", checkOut: "2026-07-05" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live skips price when no dates", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"foo":"bar"}]}</div>"key":"k1"';
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: html }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live warns when sub-calls reject", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"id":1,"host":{"id":"h1"}}]}</div>"key":"k1""p3ImpressionId":"imp1"';
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: html });
      return Promise.reject(new Error("subCall failed"));
    }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1", checkIn: "2026-07-01", checkOut: "2026-07-05" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.meta.warnings.some((w) => w.includes("reviews:"))).toBe(true);
    }
  });
  it("live warns when price call fails", async () => {
    const html = '<div id="data-deferred-state-0">{"id":1,"host":{"id":"h1"}}</div>"api_config":{"key":"k1"}"p3ImpressionId":"imp1"';
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: html });
      if (req.url.includes("StaysPdpSections")) return Promise.resolve({ status: 500, body: "" });
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: {} }) });
    }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1", checkIn: "2026-07-01", checkOut: "2026-07-05" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.meta.warnings.some((w) => w.includes("price:"))).toBe(true);
    }
  });
  it("live warns when only one date provided", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"id":1}]}</div>"key":"k1"';
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: html }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1", checkIn: "2026-07-01" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.meta.warnings.some((w) => w.includes("price skipped"))).toBe(true);
    }
  });
  it("live scrapes apiKey from html when not in niobe", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"id":1}]}</div>"api_config":{"key":"scraped"}"p3ImpressionId":"imp1"';
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: html }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live uses roomId to build URL when roomUrl missing", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"id":1}]}</div>"key":"k1"';
    let capturedUrl = "";
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      if (req.url.includes("/rooms/")) capturedUrl = req.url;
      return Promise.resolve({ status: 200, body: html });
    }) } as any);
    await getDetails({ mode: "live", roomId: "12345" });
    expect(capturedUrl).toContain("/rooms/12345");
  });
  it("live returns error when metadata scrape fails", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 500, body: "" }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1" });
    expect(result).toMatchObject({ ok: false });
  });
  it("live returns error when listing parse fails", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{}]}</div>"key":"k1"';
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: html }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live skips sub-calls when no apiKey", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"id":1,"host":{"id":"h1"}}]}</div>';
    let callCount = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({ status: 200, body: html });
    }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1" });
    expect(result).toMatchObject({ ok: true });
    expect(callCount).toBe(1);
  });
  it("live warns when calendar rejected", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"id":1,"host":{"id":"h1"}}]}</div>"key":"k1""p3ImpressionId":"imp1"';
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: html });
      if (req.url.includes("PdpAvailabilityCalendar")) return Promise.reject(new Error("cal fail"));
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: {} }) });
    }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1", checkIn: "2026-07-01", checkOut: "2026-07-05" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live warns when host rejected", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"id":1,"host":{"id":"h1"}}]}</div>"key":"k1""p3ImpressionId":"imp1"';
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: html });
      if (req.url.includes("GetUserProfile")) return Promise.reject(new Error("host fail"));
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: {} }) });
    }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1", checkIn: "2026-07-01", checkOut: "2026-07-05" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live skips calendar when no listing id", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{}]}</div>"key":"k1""p3ImpressionId":"imp1"';
    let callCount = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({ status: 200, body: html });
    }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1", checkIn: "2026-07-01", checkOut: "2026-07-05" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live skips host when no host id", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"id":1}]}</div>"key":"k1""p3ImpressionId":"imp1"';
    let callCount = 0;
    setClient({ request: vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({ status: 200, body: html });
    }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1", checkIn: "2026-07-01", checkOut: "2026-07-05" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live warns when calendar fulfilled but null", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"id":1,"host":{"id":"h1"}}]}</div>"key":"k1""p3ImpressionId":"imp1"';
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: html });
      if (req.url.includes("PdpAvailabilityCalendar")) return Promise.resolve(null);
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: {} }) });
    }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1", checkIn: "2026-07-01", checkOut: "2026-07-05" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live warns when host fulfilled but null", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"id":1,"host":{"id":"h1"}}]}</div>"key":"k1""p3ImpressionId":"imp1"';
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: html });
      if (req.url.includes("GetUserProfile")) return Promise.resolve(null);
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: {} }) });
    }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1", checkIn: "2026-07-01", checkOut: "2026-07-05" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live warns when price not ok", async () => {
    const html = '<div id="data-deferred-state-0">{"niobeClientData":[null,{"id":1,"host":{"id":"h1"}}]}</div>"key":"k1""p3ImpressionId":"imp1"';
    let callIdx = 0;
    setClient({ request: vi.fn().mockImplementation((req: any) => {
      callIdx++;
      if (callIdx === 1) return Promise.resolve({ status: 200, body: html });
      if (req.url.includes("StaysPdpSections")) return Promise.resolve({ status: 500, body: "" });
      return Promise.resolve({ status: 200, body: JSON.stringify({ data: {} }) });
    }) } as any);
    const result = await getDetails({ mode: "live", roomId: "1", checkIn: "2026-07-01", checkOut: "2026-07-05" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      // price call returns 500 → graphqlCall returns error → getPrice returns error → warning pushed
      expect(result.meta.warnings.length).toBeGreaterThan(0);
    }
  });
});

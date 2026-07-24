import { describe, it, expect, vi, afterEach } from "vitest";
import { getCalendar } from "../src/endpoints/get-calendar.js";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

describe("getCalendar", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("reprocess parses raw calendar", async () => {
    const raw = { data: { merlin: { pdpAvailabilityCalendar: { calendarMonths: [{ month: 7, year: 2026, days: [] }] } } } };
    const result = await getCalendar({ mode: "reprocess", raw });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.length).toBe(1);
  });
  it("live fetches calendar via graphql", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { merlin: { pdpAvailabilityCalendar: { calendarMonths: [] } } } }) }) } as any);
    const result = await getCalendar({ mode: "live", roomId: "1", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live returns block on 403", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 403, body: "" }) } as any);
    const result = await getCalendar({ mode: "live", roomId: "1", apiKey: "k" });
    expect(result).toMatchObject({ ok: false, code: "block" });
  });
});

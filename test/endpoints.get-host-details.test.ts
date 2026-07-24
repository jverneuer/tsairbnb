import { describe, it, expect, vi, afterEach } from "vitest";
import { getHostDetails } from "../src/endpoints/get-host-details.js";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";

describe("getHostDetails", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("reprocess parses raw host profile", async () => {
    const raw = { data: { presentation: { user: { id: "VXNlcjo0Mg==", name: "Maja" } } } };
    const result = await getHostDetails({ mode: "reprocess", raw });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.data.id).toBe("42");
      expect(result.data.name).toBe("Maja");
    }
  });
  it("live fetches host profile via graphql", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { presentation: { user: { id: "VXNlcjo0Mg==", name: "Maja" } } } }) }) } as any);
    const result = await getHostDetails({ mode: "live", hostId: "42", apiKey: "k" });
    expect(result).toMatchObject({ ok: true });
  });
  it("live returns block on 403", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 403, body: "" }) } as any);
    const result = await getHostDetails({ mode: "live", hostId: "42", apiKey: "k" });
    expect(result).toMatchObject({ ok: false, code: "block" });
  });
});

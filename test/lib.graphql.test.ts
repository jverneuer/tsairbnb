import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { graphqlCall } from "../src/lib/graphql.js";
import { getClient, setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";
import { setConfig } from "../src/config/load.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

// Mock dynamic StaysSearch hash resolver
vi.mock("../src/registry/hashes-resolver.js", () => ({
  fetchStaysSearchHash: vi.fn().mockResolvedValue("a".repeat(64)),
}));

// Use a non-StaysSearch operation to avoid dynamic resolver
const OP = "GetUserProfile";

describe("graphqlCall", () => {
  beforeEach(() => {
    setConfig(DEFAULT_CONFIG);
  });

  it("builds persisted-query URL and returns data on GET", async () => {
    const mockClient = {
      request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { foo: "bar" } }) }),
    };
    setClient(mockClient as any);
    const result = await graphqlCall("StaysSearch", { x: 1 }, "key");
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.data).toEqual({ foo: "bar" });
    expect(mockClient.request).toHaveBeenCalledOnce();
    const call = mockClient.request.mock.calls[0]![0] as any;
    expect(call.url).toContain("/api/v3/StaysSearch/");
    expect(call.url).toContain("operationName=StaysSearch");
  });
  it("handles POST method", async () => {
    const mockClient = {
      request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { foo: "bar" } }) }),
    };
    setClient(mockClient as any);
    await graphqlCall("StaysSearch", { x: 1 }, "key", { method: "POST" });
    const call = mockClient.request.mock.calls[0]![0] as any;
    expect(call.method).toBe("POST");
    expect(call.body).toBeDefined();
  });
  it("returns block on 403", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 403, body: "" }) } as any);
    const result = await graphqlCall("StaysSearch", {}, "key");
    expect(result).toEqual({ error: "blocked: 403", code: "block" });
  });
  it("returns error on non-2xx", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 500, body: "" }) } as any);
    const result = await graphqlCall("StaysSearch", {}, "key");
    expect(result).toEqual({ error: "http 500", code: "http-500" });
  });
  it("returns error on non-JSON", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: "not json" }) } as any);
    const result = await graphqlCall("StaysSearch", {}, "key");
    expect(result).toEqual({ error: "response was not JSON", code: "parse" });
  });
  it("returns error when no data field", async () => {
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ foo: "bar" }) }) } as any);
    const result = await graphqlCall("StaysSearch", {}, "key");
    expect(result).toEqual({ error: "no data field in response", code: "parse" });
  });
  it("validates against rawSchema when provided", async () => {
    const { z } = await import("zod");
    const schema = z.object({ data: z.object({ x: z.number() }) });
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { x: 1 } }) }) } as any);
    const result = await graphqlCall("StaysSearch", {}, "key", { rawSchema: schema });
    expect("error" in result).toBe(false);
  });
  it("returns validation error when rawSchema fails", async () => {
    const { z } = await import("zod");
    const schema = z.object({ data: z.object({ x: z.string() }) });
    setClient({ request: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ data: { x: 1 } }) }) } as any);
    const result = await graphqlCall("StaysSearch", {}, "key", { rawSchema: schema });
    expect("error" in result).toBe(true);
  });

  it("omits respondedDomain when effectiveUrl is empty", async () => {
    setClient({
      request: vi.fn().mockResolvedValue({
        status: 200,
        body: JSON.stringify({ data: { foo: "bar" } }),
        effectiveUrl: "",
      }),
    } as any);
    const result = await graphqlCall(OP, {}, "k");
    expect("error" in result).toBe(false);
    if (!("error" in result)) expect(result.respondedDomain).toBeUndefined();
  });

  it("returns data with rawSchema validation (no data wrapper)", async () => {
    const { z } = await import("zod");
    setClient({
      request: vi.fn().mockResolvedValue({
        status: 200,
        body: JSON.stringify({ foo: "bar" }),
        effectiveUrl: "",
      }),
    } as any);
    const result = await graphqlCall(OP, {}, "k", {
      rawSchema: z.object({ foo: z.string() }),
    });
    expect("error" in result).toBe(false);
  });

  afterEach(() => {
    setClient(new CurlImpersonateClient());
  });
});

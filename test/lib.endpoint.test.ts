import { describe, it, expect, vi } from "vitest";

const mockGraphqlCall = vi.fn().mockResolvedValue({ data: { foo: "bar" }, raw: { foo: "bar" } });
vi.mock("../src/lib/graphql.js", () => ({
  graphqlCall: (...args: unknown[]) => mockGraphqlCall(...args),
}));
vi.mock("../src/telemetry.js", () => ({ emit: vi.fn() }));

import { createEndpoint, createPaginatedEndpoint } from "../src/lib/endpoint.js";

describe("createEndpoint", () => {
  it("reprocess returns parsed data with meta", async () => {
    const ep = createEndpoint({
      operation: "Op",
      method: "GET",
      rawSchema: {} as any,
      parse: async () => ({ data: "parsed", parserVersion: "v1", warnings: [] }),
      name: "ep",
      getApiKey: () => "k",
      buildVariables: () => ({}),
    });
    const result = await ep({ mode: "reprocess", raw: { foo: "bar" } });
    expect(result).toMatchObject({ ok: true, data: "parsed", raw: { foo: "bar" } });
    if (result.ok) expect(result.meta.mode).toBe("reprocess");
  });
  it("reprocess returns error on parse failure", async () => {
    const ep = createEndpoint({
      operation: "Op",
      method: "GET",
      rawSchema: {} as any,
      parse: async () => ({ error: "bad" }),
      name: "ep",
      getApiKey: () => "k",
      buildVariables: () => ({}),
    });
    const result = await ep({ mode: "reprocess", raw: {} });
    expect(result).toEqual({ ok: false, error: "bad", code: "parse" });
  });
  it("live returns parsed data on success", async () => {
    mockGraphqlCall.mockResolvedValueOnce({ data: { result: "ok" }, raw: { result: "ok" } });
    const ep = createEndpoint({
      operation: "Op",
      method: "GET",
      rawSchema: {} as any,
      parse: async () => ({ data: "live-parsed", parserVersion: "v2", warnings: [] }),
      name: "ep",
      getApiKey: () => "k",
      buildVariables: () => ({}),
    });
    const result = await ep({ mode: "live" } as any);
    expect(result).toMatchObject({ ok: true, data: "live-parsed" });
    if (result.ok) expect(result.meta.mode).toBe("live");
  });
  it("live returns error when parse fails", async () => {
    mockGraphqlCall.mockResolvedValueOnce({ data: { foo: "bar" }, raw: { foo: "bar" } });
    const ep = createEndpoint({
      operation: "Op",
      method: "GET",
      rawSchema: {} as any,
      parse: async () => ({ error: "live-parse-failed" }),
      name: "ep",
      getApiKey: () => "k",
      buildVariables: () => ({}),
    });
    const result = await ep({ mode: "live" } as any);
    expect(result).toEqual({ ok: false, error: "live-parse-failed", code: "parse" });
  });
  it("live returns error when graphqlCall fails", async () => {
    mockGraphqlCall.mockResolvedValueOnce({ error: "http 500", code: "http-500" });
    const ep = createEndpoint({
      operation: "Op",
      method: "GET",
      rawSchema: {} as any,
      parse: async () => ({ data: "x", parserVersion: "v1", warnings: [] }),
      name: "ep",
      getApiKey: () => "k",
      buildVariables: () => ({}),
    });
    const result = await ep({ mode: "live" } as any);
    expect(result).toEqual({ ok: false, error: "http 500", code: "http-500" });
  });
});

describe("createPaginatedEndpoint", () => {
  it("reprocess returns extracted items", async () => {
    const ep = createPaginatedEndpoint({
      operation: "Op",
      method: "GET",
      rawSchema: {} as any,
      parse: async () => ({ data: { items: [1, 2, 3], next: null }, parserVersion: "v1", warnings: [] }),
      name: "ep",
      getApiKey: () => "k",
      buildVariables: () => ({}),
      extractItems: (data: any) => data.items,
      getNextCursor: () => null,
    });
    const result = await ep({ mode: "reprocess", raw: {} });
    expect(result).toMatchObject({ ok: true, data: [1, 2, 3] });
  });
  it("reprocess returns error on parse failure", async () => {
    const ep = createPaginatedEndpoint({
      operation: "Op",
      method: "GET",
      rawSchema: {} as any,
      parse: async () => ({ error: "bad" }),
      name: "ep",
      getApiKey: () => "k",
      buildVariables: () => ({}),
      extractItems: () => [],
      getNextCursor: () => null,
    });
    const result = await ep({ mode: "reprocess", raw: {} });
    expect(result).toEqual({ ok: false, error: "bad", code: "parse" });
  });
  it("live returns extracted items on success", async () => {
    mockGraphqlCall.mockResolvedValueOnce({ data: { items: [1, 2] }, raw: { items: [1, 2] } });
    const ep = createPaginatedEndpoint({
      operation: "Op",
      method: "GET",
      rawSchema: {} as any,
      parse: async () => ({ data: { items: [1, 2] }, parserVersion: "v1", warnings: [] }),
      name: "ep",
      getApiKey: () => "k",
      buildVariables: () => ({}),
      extractItems: (data: any) => data.items,
      getNextCursor: () => null,
    });
    const result = await ep({ mode: "live" } as any);
    expect(result).toMatchObject({ ok: true, data: [1, 2] });
  });
  it("live returns error when parse fails", async () => {
    mockGraphqlCall.mockResolvedValueOnce({ data: { items: [1] }, raw: { items: [1] } });
    const ep = createPaginatedEndpoint({
      operation: "Op",
      method: "GET",
      rawSchema: {} as any,
      parse: async () => ({ error: "paginated-parse-failed" }),
      name: "ep",
      getApiKey: () => "k",
      buildVariables: () => ({}),
      extractItems: () => [],
      getNextCursor: () => null,
    });
    const result = await ep({ mode: "live" } as any);
    expect(result).toEqual({ ok: false, error: "paginated-parse-failed", code: "parse" });
  });
  it("live returns error when graphqlCall fails", async () => {
    mockGraphqlCall.mockResolvedValueOnce({ error: "blocked", code: "block" });
    const ep = createPaginatedEndpoint({
      operation: "Op",
      method: "GET",
      rawSchema: {} as any,
      parse: async () => ({ data: { items: [] }, parserVersion: "v1", warnings: [] }),
      name: "ep",
      getApiKey: () => "k",
      buildVariables: () => ({}),
      extractItems: () => [],
      getNextCursor: () => null,
    });
    const result = await ep({ mode: "live" } as any);
    expect(result).toEqual({ ok: false, error: "blocked", code: "block" });
  });
});

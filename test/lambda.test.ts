import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDispatch = vi.fn().mockResolvedValue({ ok: true, data: "x" });
const mockListEndpoints = vi.fn().mockReturnValue(["get-details", "search-all"]);
vi.mock("../src/dispatcher.js", () => ({
  dispatch: (...args: unknown[]) => mockDispatch(...args),
  listEndpoints: () => mockListEndpoints(),
}));
const mockInitFromSsm = vi.fn().mockResolvedValue(undefined);
vi.mock("../src/config/ssm-bootstrap.js", () => ({
  initFromSsm: (...args: unknown[]) => mockInitFromSsm(...args),
}));

import { handler } from "../src/lambda.js";

describe("lambda handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatch.mockResolvedValue({ ok: true, data: "x" });
  });

  it("returns health discovery when no endpoint", async () => {
    const result = await handler({ rawPath: "/", rawQueryString: "", queryStringParameters: null, body: null } as any);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.endpoints).toEqual(["get-details", "search-all"]);
  });
  it("dispatches live request", async () => {
    const result = await handler({ rawPath: "/", rawQueryString: "endpoint=get-details", queryStringParameters: { endpoint: "get-details" }, body: null } as any);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "get-details", mode: "live" }));
    expect(result.statusCode).toBe(200);
  });
  it("dispatches reprocess with raw from query", async () => {
    // API Gateway decodes QS params before passing to Lambda
    const raw = JSON.stringify({ foo: "bar" });
    const result = await handler({ rawPath: "/", rawQueryString: `endpoint=get-details&mode=reprocess&raw=${encodeURIComponent(raw)}`, queryStringParameters: { endpoint: "get-details", mode: "reprocess", raw }, body: null } as any);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ mode: "reprocess", raw: { foo: "bar" } }));
  });
  it("dispatches reprocess with raw from body", async () => {
    const result = await handler({ rawPath: "/", rawQueryString: "endpoint=get-details&mode=reprocess", queryStringParameters: { endpoint: "get-details", mode: "reprocess" }, body: JSON.stringify({ foo: "bar" }) } as any);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ mode: "reprocess", raw: { foo: "bar" } }));
  });
  it("returns 400 on invalid raw JSON in query", async () => {
    const result = await handler({ rawPath: "/", rawQueryString: "endpoint=x&mode=reprocess&raw=notjson", queryStringParameters: { endpoint: "x", mode: "reprocess", raw: "notjson" }, body: null } as any);
    expect(result.statusCode).toBe(400);
  });
  it("returns 400 on invalid raw JSON in body", async () => {
    const result = await handler({ rawPath: "/", rawQueryString: "endpoint=x&mode=reprocess", queryStringParameters: { endpoint: "x", mode: "reprocess" }, body: "notjson" } as any);
    expect(result.statusCode).toBe(400);
  });
  it("returns 400 on input error from dispatcher", async () => {
    mockDispatch.mockResolvedValueOnce({ ok: false, error: "bad", code: "input" });
    const result = await handler({ rawPath: "/", rawQueryString: "endpoint=x", queryStringParameters: { endpoint: "x" }, body: null } as any);
    expect(result.statusCode).toBe(400);
  });
  it("returns 403 on block", async () => {
    mockDispatch.mockResolvedValueOnce({ ok: false, error: "blocked", code: "block" });
    const result = await handler({ rawPath: "/", rawQueryString: "endpoint=x", queryStringParameters: { endpoint: "x" }, body: null } as any);
    expect(result.statusCode).toBe(403);
  });
  it("returns 502 on other errors", async () => {
    mockDispatch.mockResolvedValueOnce({ ok: false, error: "fail", code: "http-500" });
    const result = await handler({ rawPath: "/", rawQueryString: "endpoint=x", queryStringParameters: { endpoint: "x" }, body: null } as any);
    expect(result.statusCode).toBe(502);
  });
  it("handles undefined queryStringParameters", async () => {
    const result = await handler({ rawPath: "/", rawQueryString: "", queryStringParameters: undefined as any, body: null } as any);
    expect(result.statusCode).toBe(200);
  });
  it("handles null queryStringParameters", async () => {
    const result = await handler({ rawPath: "/", rawQueryString: "", queryStringParameters: null, body: null } as any);
    expect(result.statusCode).toBe(200);
  });
  it("defaults mode to live when not specified", async () => {
    const result = await handler({ rawPath: "/", rawQueryString: "endpoint=get-details", queryStringParameters: { endpoint: "get-details" }, body: null } as any);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ mode: "live" }));
    expect(result.statusCode).toBe(200);
  });
  it("handles empty queryStringParameters", async () => {
    const result = await handler({ rawPath: "/", rawQueryString: "", queryStringParameters: {}, body: null } as any);
    expect(result.statusCode).toBe(200);
  });
  it("skips undefined queryStringParameters values", async () => {
    const result = await handler({ rawPath: "/", rawQueryString: "", queryStringParameters: { endpoint: "x", mode: undefined as any }, body: null } as any);
    expect(result.statusCode).toBe(200);
  });
  it("handles reprocess with raw from body when qs.raw missing", async () => {
    const result = await handler({ rawPath: "/", rawQueryString: "endpoint=x&mode=reprocess", queryStringParameters: { endpoint: "x", mode: "reprocess" }, body: JSON.stringify({ foo: "bar" }) } as any);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ mode: "reprocess", raw: { foo: "bar" } }));
  });
  it("handles reprocess with raw from qs.raw (query string)", async () => {
    const rawJson = encodeURIComponent(JSON.stringify({ foo: "qs" }));
    const result = await handler({ rawPath: "/", rawQueryString: `endpoint=x&mode=reprocess&raw=${rawJson}`, queryStringParameters: { endpoint: "x", mode: "reprocess", raw: rawJson }, body: null } as any);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ mode: "reprocess", raw: { foo: "qs" } }));
  });
  it("reprocess with no raw and no body leaves raw undefined", async () => {
    const result = await handler({ rawPath: "/", rawQueryString: "endpoint=x&mode=reprocess", queryStringParameters: { endpoint: "x", mode: "reprocess" }, body: null } as any);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ mode: "reprocess", raw: undefined }));
    expect(result.statusCode).toBe(200);
  });
  it("ensureInit catches SSM failure and continues", async () => {
    vi.resetModules();
    mockInitFromSsm.mockRejectedValueOnce(new Error("SSM down"));
    const { handler: freshHandler } = await import("../src/lambda.js");
    const result = await freshHandler({ rawPath: "/", rawQueryString: "", queryStringParameters: null, body: null } as any);
    expect(result.statusCode).toBe(200);
  });
});

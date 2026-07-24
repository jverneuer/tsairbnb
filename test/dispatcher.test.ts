import { describe, it, expect, vi, afterEach } from "vitest";
import { register, listEndpoints, dispatch } from "../src/dispatcher.js";
import * as domain from "../src/lib/domain.js";

describe("dispatcher", () => {
  it("register + listEndpoints", () => {
    register("test-ep", vi.fn() as any);
    expect(listEndpoints()).toContain("test-ep");
  });
  it("dispatch returns error on unknown endpoint", async () => {
    const result = await dispatch({ endpoint: "nope", mode: "live" });
    expect(result).toEqual({ ok: false, error: "unknown endpoint: nope", code: "input" });
  });
  it("dispatch returns error on invalid input", async () => {
    const result = await dispatch({ endpoint: "", mode: "live" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("input");
  });
  it("dispatch returns error when reprocess without raw", async () => {
    register("reprocess-ep", vi.fn() as any);
    const result = await dispatch({ endpoint: "reprocess-ep", mode: "reprocess" });
    expect(result).toEqual({ ok: false, error: "reprocess mode requires `raw`", code: "input" });
  });
  it("dispatch calls handler and returns its result", async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true, data: "x", raw: null, meta: {} });
    register("live-ep", handler as any);
    const result = await dispatch({ endpoint: "live-ep", mode: "live", extra: "q" });
    expect(handler).toHaveBeenCalledWith({ mode: "live", extra: "q" });
    expect(result).toEqual({ ok: true, data: "x", raw: null, meta: {} });
  });
  it("dispatch catches handler throws and returns error envelope", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("kaboom"));
    register("throw-ep", handler as any);
    const result = await dispatch({ endpoint: "throw-ep", mode: "live" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("handler-threw");
      expect(result.meta?.warnings).toContain("kaboom");
    }
  });
});

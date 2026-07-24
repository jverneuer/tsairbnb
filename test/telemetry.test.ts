import { describe, it, expect, vi } from "vitest";
import { onEvent, emit } from "../src/telemetry.js";

describe("telemetry", () => {
  it("onEvent attaches sink and returns detach fn", () => {
    const sink = vi.fn();
    const detach = onEvent(sink);
    emit({ t: "http", endpoint: "x", status: 200, durationMs: 1 });
    expect(sink).toHaveBeenCalledOnce();
    detach();
    emit({ t: "http", endpoint: "x", status: 200, durationMs: 1 });
    expect(sink).toHaveBeenCalledOnce();
  });
  it("emit fans out to multiple sinks", () => {
    const a = vi.fn();
    const b = vi.fn();
    onEvent(a);
    onEvent(b);
    emit({ t: "parse", endpoint: "x", parserVersion: "v1", warnings: [], durationMs: 0 });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });
  it("emit swallows sink errors", () => {
    const bad = vi.fn().mockImplementation(() => { throw new Error("boom"); });
    const good = vi.fn();
    onEvent(bad);
    onEvent(good);
    emit({ t: "block", endpoint: "x", reason: "test" });
    expect(good).toHaveBeenCalledOnce();
  });
});

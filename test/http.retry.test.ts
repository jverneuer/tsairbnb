import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "../src/http/retry.js";
import { setConfig } from "../src/config/load.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setConfig({ ...DEFAULT_CONFIG, timeoutMs: 30_000 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns on first success", async () => {
    const fn = vi.fn().mockResolvedValue({ status: 200, value: "ok" });
    const result = await withRetry(fn, { retries: 3, endpoint: "test" });
    expect(result).toEqual({ status: 200, value: "ok" });
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("does not retry on non-retryable status (e.g. 403)", async () => {
    const fn = vi.fn().mockResolvedValue({ status: 403, value: "blocked" });
    const result = await withRetry(fn, { retries: 3, endpoint: "test" });
    expect(result).toEqual({ status: 403, value: "blocked" });
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("retries on retryable status (503) then succeeds", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ status: 503, value: "fail" })
      .mockResolvedValueOnce({ status: 200, value: "ok" });
    const p = withRetry(fn, { retries: 3, endpoint: "test" });
    await vi.advanceTimersByTimeAsync(2000);
    const result = await p;
    expect(result).toEqual({ status: 200, value: "ok" });
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it("exhausts retries and returns last status", async () => {
    const fn = vi.fn().mockResolvedValue({ status: 503, value: "fail" });
    const p = withRetry(fn, { retries: 2, endpoint: "test" });
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await p;
    expect(result).toEqual({ status: 503, value: "fail" });
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it("retries on thrown error then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ status: 200, value: "ok" });
    const p = withRetry(fn, { retries: 3, endpoint: "test" });
    await vi.advanceTimersByTimeAsync(2000);
    const result = await p;
    expect(result).toEqual({ status: 200, value: "ok" });
  });
  it("throws when retries exhausted on error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("network"));
    const p = withRetry(fn, { retries: 1, endpoint: "test" });
    await expect(vi.advanceTimersByTimeAsync(5000) && p).rejects.toThrow("network");
  });
});

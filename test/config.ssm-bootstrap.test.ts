import { describe, it, expect, vi } from "vitest";

const mockSend = vi.fn();
vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: function () { this.send = (cmd: unknown) => mockSend(cmd); },
  GetParameterCommand: function (opts: unknown) { return opts; },
}));

import { loadConfig, getConfig } from "../src/config/load.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

describe("initFromSsm", () => {
  it("loads config from SSM and applies", async () => {
    loadConfig(DEFAULT_CONFIG);
    mockSend.mockResolvedValueOnce({ Parameter: { Value: JSON.stringify({ ...DEFAULT_CONFIG, locale: "mk" }) } });
    const { initFromSsm } = await import("../src/config/ssm-bootstrap.js");
    await initFromSsm();
    expect(getConfig().locale).toBe("mk");
  });
  it("swallows errors when SSM fails", async () => {
    loadConfig(DEFAULT_CONFIG);
    mockSend.mockRejectedValueOnce(new Error("network"));
    const { initFromSsm } = await import("../src/config/ssm-bootstrap.js");
    await expect(initFromSsm()).resolves.toBeUndefined();
  });
  it("does not re-bootstrap on second call", async () => {
    loadConfig(DEFAULT_CONFIG);
    mockSend.mockResolvedValue({ Parameter: { Value: JSON.stringify(DEFAULT_CONFIG) } });
    const { initFromSsm } = await import("../src/config/ssm-bootstrap.js");
    await initFromSsm();
    await initFromSsm();
    expect(mockSend).toHaveBeenCalledOnce();
  });
});

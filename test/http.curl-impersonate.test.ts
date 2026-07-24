import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSpawn, mockSpawnSync } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockSpawnSync: vi.fn(),
}));
vi.mock("node:child_process", () => ({
  spawn: mockSpawn,
  spawnSync: mockSpawnSync,
}));

import { getClient, setClient, CurlImpersonateClient, demux, parseCookieJar, run } from "../src/http/curl-impersonate.js";
import { setConfig, getConfig } from "../src/config/load.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

function makeMockChild(stdout: string, code: number, error?: Error) {
  const handlers: Record<string, any> = {};
  const child = {
    stdout: {
      on: (event: string, cb: any) => {
        if (event === "data") cb(Buffer.from(stdout));
      },
    },
    stderr: {
      on: (event: string, cb: any) => {
        if (event === "data") cb(Buffer.from(""));
      },
    },
    stdin: {
      write: vi.fn(),
      end: vi.fn(),
    },
    on: (event: string, cb: any) => {
      handlers[event] = cb;
      if (event === "error" && error) {
        setTimeout(() => cb(error), 0);
      } else if (event === "close" && !error) {
        setTimeout(() => cb(code), 0);
      }
    },
  };
  return child;
}

describe("CurlImpersonateClient", () => {
  beforeEach(() => {
    setConfig(DEFAULT_CONFIG);
    delete process.env.TSAIRBNB_PROXY_SEED;
    mockSpawn.mockReset();
    mockSpawnSync.mockReset();
  });

  it("getClient returns singleton", () => {
    expect(getClient()).toBeInstanceOf(CurlImpersonateClient);
  });

  it("setClient overrides the client", () => {
    const mock = { request: vi.fn() };
    setClient(mock as any);
    expect(getClient()).toBe(mock);
    setClient(new CurlImpersonateClient());
  });

  it("buildArgs includes silent flags and headers", () => {
    const client = new CurlImpersonateClient();
    const args = (client as any).buildArgs({ url: "http://x.com", headers: { "User-Agent": "ua" } });
    expect(args).toContain("-s");
    expect(args).toContain("-S");
    expect(args).toContain("http://x.com");
    expect(args).toContain("-H");
    expect(args).toContain("User-Agent: ua");
  });

  it("buildArgs includes proxy when pool size 1", () => {
    setConfig({ ...DEFAULT_CONFIG, proxies: ["http://p1"] });
    const client = new CurlImpersonateClient();
    const args = (client as any).buildArgs({ url: "http://x.com" });
    expect(args).toContain("--proxy");
    expect(args).toContain("http://p1");
  });

  it("buildArgs includes proxy when pool size > 1", () => {
    setConfig({ ...DEFAULT_CONFIG, proxies: ["http://p1", "http://p2"] });
    process.env.TSAIRBNB_PROXY_SEED = "1";
    const client = new CurlImpersonateClient();
    const args = (client as any).buildArgs({ url: "http://x.com" });
    expect(args).toContain("--proxy");
    expect(args).toContain("http://p2");
  });

  it("buildArgs omits proxy when pool empty", () => {
    setConfig({ ...DEFAULT_CONFIG, proxies: [] });
    const client = new CurlImpersonateClient();
    const args = (client as any).buildArgs({ url: "http://x.com" });
    expect(args).not.toContain("--proxy");
  });

  it("buildArgs uses POST method", () => {
    const client = new CurlImpersonateClient();
    const args = (client as any).buildArgs({ url: "http://x.com", method: "POST" });
    expect(args).toContain("POST");
  });

  it("buildArgs uses custom timeout", () => {
    setConfig({ ...DEFAULT_CONFIG, timeoutMs: 60000 });
    const client = new CurlImpersonateClient();
    const args = (client as any).buildArgs({ url: "http://x.com" });
    expect(args).toContain("--max-time");
    expect(args).toContain("60");
  });

  it("request calls run and returns parsed response", async () => {
    const stdout = "HTTP/1.1 200\r\n\r\nbody\r\n__HTTP_STATUS__:200";
    mockSpawn.mockReturnValue(makeMockChild(stdout, 0) as any);

    const client = new CurlImpersonateClient();
    const response = await client.request({ url: "http://example.com" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "curl-impersonate-chrome",
      expect.arrayContaining(["-s", "-S", "http://example.com"]),
      { timeout: 30000 },
    );
    expect(response.status).toBe(200);
    expect(response.body).toContain("body");
  });

  it("request parses cookies from jar", async () => {
    const stdout = "HTTP/1.1 200\r\n\r\nbody\r\n__HTTP_STATUS__:200\n.airbnb.com\tTRUE\t/\tTRUE\t0\tsid\tabc123";
    mockSpawn.mockReturnValue(makeMockChild(stdout, 0) as any);

    const client = new CurlImpersonateClient();
    const response = await client.request({ url: "http://example.com" });

    expect(response.cookies).toEqual({ sid: "abc123" });
  });

  it("request writes body to stdin for POST", async () => {
    const stdout = "HTTP/1.1 200\r\n\r\nok\r\n__HTTP_STATUS__:200";
    const child = makeMockChild(stdout, 0);
    mockSpawn.mockReturnValue(child as any);

    const client = new CurlImpersonateClient();
    await client.request({ url: "http://example.com", method: "POST", body: '{"key":"val"}' });

    expect(child.stdin.write).toHaveBeenCalledWith('{"key":"val"}');
    expect(child.stdin.end).toHaveBeenCalled();
  });
});

describe("run", () => {
  beforeEach(() => {
    mockSpawn.mockReset();
    mockSpawnSync.mockReset();
  });

  it("resolves with status, stdout, cookieHeader on success", async () => {
    const stdout = "HTTP/1.1 200\r\n\r\nbody\r\n__HTTP_STATUS__:200";
    mockSpawn.mockReturnValue(makeMockChild(stdout, 0) as any);

    const result = await run("curl-impersonate-chrome", ["-s"], undefined, 30000);

    expect(result.status).toBe(200);
    expect(result.stdout).toContain("body");
  });

  it("rejects when spawn emits error", async () => {
    mockSpawn.mockReturnValue(makeMockChild("", 0, new Error("ENOENT")) as any);

    await expect(run("curl-impersonate-chrome", ["-s"], undefined, 30000)).rejects.toThrow("ENOENT");
  });

  it("rejects when child exits non-zero with empty stdout", async () => {
    mockSpawn.mockReturnValue(makeMockChild("", 1) as any);

    await expect(run("curl-impersonate-chrome", ["-s"], undefined, 30000)).rejects.toThrow(
      "curl-impersonate-chrome exited 1",
    );
  });

  it("resolves even with non-zero exit code when stdout has content", async () => {
    const stdout = "HTTP/1.1 500\r\n\r\nerror\r\n__HTTP_STATUS__:500";
    mockSpawn.mockReturnValue(makeMockChild(stdout, 1) as any);

    const result = await run("curl-impersonate-chrome", ["-s"], undefined, 30000);
    expect(result.status).toBe(500);
  });
});

describe("demux", () => {
  it("parses body after blank line, default status 200", () => {
    const stdout = "ignored\r\n\r\nbody here";
    const result = demux(stdout);
    expect(result.status).toBe(200);
    expect(result.body).toContain("body here");
  });

  it("parses custom status from __HTTP_STATUS__ trailer", () => {
    const stdout = "ignored\r\n\r\nbody\r\n__HTTP_STATUS__:403";
    const result = demux(stdout);
    expect(result.status).toBe(403);
  });

  it("returns full body when no blank line separator", () => {
    const result = demux("no status");
    expect(result.status).toBe(200);
    expect(result.body).toBe("no status");
  });

  it("extracts cookie jar lines", () => {
    const stdout = "ignored\r\n\r\nbody\n#HttpOnly_.airbnb.com\tTRUE\t/\tTRUE\t0\tc\tv";
    const result = demux(stdout);
    expect(result.cookies).toContain("HttpOnly_");
  });

  it("returns empty effectiveUrl when no __URL_EFFECTIVE__ trailer", () => {
    const stdout = "ignored\r\n\r\nbody\r\n__HTTP_STATUS__:200";
    const result = demux(stdout);
    expect(result.effectiveUrl).toBe("");
  });

  it("strips __HTTP_STATUS__ from body", () => {
    const stdout = "HTTP/1.1 200\r\n\r\nbody\r\n__HTTP_STATUS__:200";
    const result = demux(stdout);
    expect(result.body).not.toContain("__HTTP_STATUS__");
  });
});

describe("parseCookieJar", () => {
  it("parses netscape jar", () => {
    const jar = ".airbnb.com\tTRUE\t/\tTRUE\t1234567890\tcookie_name\tcookie_value";
    expect(parseCookieJar(jar)).toEqual({ cookie_name: "cookie_value" });
  });

  it("skips comments and blank lines", () => {
    expect(parseCookieJar("# comment\n\n")).toEqual({});
  });

  it("handles multiple cookies", () => {
    const jar = "_\tTRUE\t/\tTRUE\t0\ta\t1\n_\tTRUE\t/\tTRUE\t0\tb\t2";
    expect(parseCookieJar(jar)).toEqual({ a: "1", b: "2" });
  });

  it("skips rows with fewer than 7 columns", () => {
    expect(parseCookieJar("a\tb\tc")).toEqual({});
  });

  it("skips rows with empty name or value", () => {
    expect(parseCookieJar("_\tTRUE\t/\tTRUE\t0\t\tvalue")).toEqual({});
    expect(parseCookieJar("_\tTRUE\t/\tTRUE\t0\tname\t")).toEqual({});
  });
});

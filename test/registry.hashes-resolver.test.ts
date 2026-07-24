import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setClient, CurlImpersonateClient } from "../src/http/curl-impersonate.js";
import { fetchStaysSearchHash } from "../src/registry/hashes-resolver.js";

const VALID_HASH = "a".repeat(64);
const BUNDLE_URL = "https://a0.muscache.com/airbnb/static/packages/web/en/frontend/airmetro/browser/asyncRequire.abc123.js";
const MODULE_PATH = "common/frontend/stays-search/routes/StaysSearchRoute/StaysSearchRoute.prepare.xyz789.js";

function mockClient(responses: Record<string, string>, defaultBody = "") {
  return {
    request: vi.fn().mockImplementation(async (req: { url: string }) => {
      for (const [match, body] of Object.entries(responses)) {
        if (req.url.includes(match)) return { status: 200, body };
      }
      return { status: 200, body: defaultBody };
    }),
  } as unknown as CurlImpersonateClient;
}

describe("fetchStaysSearchHash", () => {
  afterEach(() => setClient(new CurlImpersonateClient()));

  it("returns hash when candidate chunk matches HASH_PATTERNS", async () => {
    const client = mockClient({
      "airbnb.com": BUNDLE_URL,
      "asyncRequire": `some/path.js ${MODULE_PATH} other/path.js`,
      [MODULE_PATH]: `name:"StaysSearch" sha256Hash:"${VALID_HASH}"`,
    });
    setClient(client);
    expect(await fetchStaysSearchHash()).toBe(VALID_HASH);
  });

  it("throws when homepage has no bundle manifest URL", async () => {
    const client = mockClient({ "airbnb.com": "no bundle here" });
    setClient(client);
    await expect(fetchStaysSearchHash()).rejects.toThrow("no bundle manifest URL");
  });

  it("throws when bundle has no StaysSearchRoute module path", async () => {
    const client = mockClient({
      "airbnb.com": BUNDLE_URL,
      "asyncRequire": "some/other/path.js",
    });
    setClient(client);
    await expect(fetchStaysSearchHash()).rejects.toThrow("no StaysSearchRoute module path");
  });

  it("throws when no candidate chunk matches any pattern", async () => {
    const client = mockClient({
      "airbnb.com": BUNDLE_URL,
      "asyncRequire": `a.js ${MODULE_PATH} b.js`,
    }, "no hashes here");
    setClient(client);
    await expect(fetchStaysSearchHash()).rejects.toThrow("unable to extract");
  });

  it("falls back to single hash in exact module chunk", async () => {
    const client = mockClient({
      "airbnb.com": BUNDLE_URL,
      "asyncRequire": `a.js ${MODULE_PATH} b.js`,
      [MODULE_PATH]: `operationId:"${VALID_HASH}"`,
    });
    setClient(client);
    expect(await fetchStaysSearchHash()).toBe(VALID_HASH);
  });

  it("returns hash from non-module candidate chunk", async () => {
    const client = mockClient({
      "airbnb.com": BUNDLE_URL,
      "asyncRequire": `a.js ${MODULE_PATH} b.js`,
      "b.js": `name:"StaysSearch" sha256Hash:"${VALID_HASH}"`,
    }, "no hashes here");
    setClient(client);
    expect(await fetchStaysSearchHash()).toBe(VALID_HASH);
  });

  it("returns hash from operationId-first pattern", async () => {
    const client = mockClient({
      "airbnb.com": BUNDLE_URL,
      "asyncRequire": `a.js ${MODULE_PATH} b.js`,
      [MODULE_PATH]: `operationId:"${VALID_HASH}" name:"StaysSearch"`,
    }, "no hashes here");
    setClient(client);
    expect(await fetchStaysSearchHash()).toBe(VALID_HASH);
  });

  it("returns hash from /api/v3/StaysSearch/ pattern", async () => {
    const client = mockClient({
      "airbnb.com": BUNDLE_URL,
      "asyncRequire": `a.js ${MODULE_PATH} b.js`,
      [MODULE_PATH]: `/api/v3/StaysSearch/${VALID_HASH}`,
    }, "no hashes here");
    setClient(client);
    expect(await fetchStaysSearchHash()).toBe(VALID_HASH);
  });

  it("returns hash from StaysSearch/<hash> pattern", async () => {
    const client = mockClient({
      "airbnb.com": BUNDLE_URL,
      "asyncRequire": `a.js ${MODULE_PATH} b.js`,
      [MODULE_PATH]: `StaysSearch/${VALID_HASH}`,
    }, "no hashes here");
    setClient(client);
    expect(await fetchStaysSearchHash()).toBe(VALID_HASH);
  });

  it("throws when module chunk has multiple hashes", async () => {
    const client = mockClient({
      "airbnb.com": BUNDLE_URL,
      "asyncRequire": `a.js ${MODULE_PATH} b.js`,
      [MODULE_PATH]: `operationId:"${VALID_HASH}" operationId:"${"b".repeat(64)}"`,
    }, "no hashes here");
    setClient(client);
    await expect(fetchStaysSearchHash()).rejects.toThrow("unable to extract");
  });

  it("throws when module chunk has no hashes", async () => {
    const client = mockClient({
      "airbnb.com": BUNDLE_URL,
      "asyncRequire": `a.js ${MODULE_PATH} b.js`,
      [MODULE_PATH]: `no hashes here`,
    }, "no hashes here");
    setClient(client);
    await expect(fetchStaysSearchHash()).rejects.toThrow("unable to extract");
  });

  it("handles module path not in jsPaths", async () => {
    // When module path is not in jsPaths, indexOf returns -1, so start = max(0, -1-3) = 0, end = -1+36 = 35
    // The module path is still prepended to candidates, so it gets probed
    const client = mockClient({
      "airbnb.com": BUNDLE_URL,
      "asyncRequire": `${MODULE_PATH} some/other/path.js`,
      [MODULE_PATH]: `name:"StaysSearch" sha256Hash:"${VALID_HASH}"`,
    }, "no hashes here");
    setClient(client);
    expect(await fetchStaysSearchHash()).toBe(VALID_HASH);
  });
  it("handles bundle with no JS paths (jsPaths empty)", async () => {
    const client = mockClient({
      "airbnb.com": BUNDLE_URL,
      "asyncRequire": `${MODULE_PATH}`,
      [MODULE_PATH]: `name:"StaysSearch" sha256Hash:"${VALID_HASH}"`,
    }, "no hashes here");
    setClient(client);
    expect(await fetchStaysSearchHash()).toBe(VALID_HASH);
  });
  it("skips fallback when module chunk has zero hashes", async () => {
    // all.length === 0 → fallback skipped, continues to next candidate
    const OTHER = "common/frontend/stays-search/routes/OtherRoute/OtherRoute.prepare.js";
    const client = mockClient({
      "airbnb.com": BUNDLE_URL,
      "asyncRequire": `${MODULE_PATH} ${OTHER}`,
      [MODULE_PATH]: `no hashes`,
      [OTHER]: `name:"StaysSearch" sha256Hash:"${VALID_HASH}"`,
    }, "no hashes here");
    setClient(client);
    expect(await fetchStaysSearchHash()).toBe(VALID_HASH);
  });
});

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { encodeRoomId, decodeListingId, encodeHostId } from "../src/codecs/ids.js";

describe("encodeRoomId", () => {
  it("encodes default StayListing prefix", () => {
    expect(encodeRoomId(123)).toBe(Buffer.from("StayListing:123").toString("base64"));
  });
  it("encodes custom prefix", () => {
    expect(encodeRoomId(456, "DemandStayListing")).toBe(Buffer.from("DemandStayListing:456").toString("base64"));
  });
  it("encodes string ids", () => {
    expect(encodeRoomId("789")).toBe(Buffer.from("StayListing:789").toString("base64"));
  });
});

describe("decodeListingId", () => {
  it("decodes base64-encoded id", () => {
    expect(decodeListingId(encodeRoomId(1614908485455733264))).toBe(1614908485455733264);
  });
  it("returns null invalid base64", () => {
    expect(decodeListingId("!!!notbase64!!!")).toBeNull();
  });
  it("returns null when no trailing digits", () => {
    expect(decodeListingId(Buffer.from("noid").toString("base64"))).toBeNull();
  });
  it("returns null empty string", () => {
    expect(decodeListingId("")).toBeNull();
  });
  it("returns null when Buffer.from throws", () => {
    const spy = vi.spyOn(Buffer, "from").mockImplementation(() => {
      throw new Error("invalid encoding");
    });
    try {
      expect(decodeListingId("abc")).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("encodeHostId", () => {
  it("encodes with User: prefix", () => {
    expect(encodeHostId(42)).toBe(Buffer.from("User:42").toString("base64"));
  });
  it("round-trips through decodeListingId", () => {
    expect(decodeListingId(encodeHostId(999))).toBe(999);
  });
});

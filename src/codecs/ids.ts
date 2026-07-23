/**
 * ID encoding — mirrors pyairbnb's standardize.py.
 * Airbnb ships listing/host IDs as base64("Prefix:numericId"). Decode to the numeric id;
 * encode back when building GraphQL variables.
 */

export function encodeRoomId(roomId: string | number, prefix = "StayListing"): string {
  return Buffer.from(`${prefix}:${roomId}`).toString("base64");
}

export function decodeListingId(b64: string): number | null {
  let decoded: string;
  try {
    decoded = Buffer.from(b64, "base64").toString("utf-8");
  } catch {
    return null;
  }
  const m = decoded.match(/(\d+)$/);
  return m ? Number(m[1]) : null;
}

export function encodeHostId(hostId: string | number): string {
  return Buffer.from(`User:${hostId}`).toString("base64");
}

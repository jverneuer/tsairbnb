import { path } from "../lib/get.js";
import type { HostProfile } from "../types/domain.js";
import type { ParserStrategy } from "./registry.js";
import { decodeListingId } from "../codecs/ids.js";
import type { GetUserProfileRaw, UserProfileBeehiveListingQueryRaw } from "./raw.js";

/**
 * Host profile parser (`data.presentation.user`) and host's listings parser
 * (`data.beehive.getListOfListings.listings`).
 */

const PROFILE_PATH = "data.presentation.user";

export const hostProfileStrategies: ParserStrategy<HostProfile>[] = [
  {
    name: "user-profile",
    detect: (raw) => path(raw, PROFILE_PATH) !== undefined,
    parse: (raw, warnings) => {
      const u = path(raw, PROFILE_PATH) as Record<string, unknown>;
      const idVal = path(u, "id");
      const decodedId = idVal !== undefined && idVal !== null ? decodeListingId(String(idVal)) : null;
      const listingsCountRaw = path(u, "listingsCount");
      const profile: HostProfile = {
        id: decodedId != null ? String(decodedId) : null,
        name: path(u, "name") as string | null,
        about: path(u, "about") as string | null,
        location: path(u, "location") as string | null,
        isSuperhost: path(u, "isSuperhost") as boolean | null,
        responseRate: path(u, "responseRate") as number | null,
        responseTime: typeof path(u, "responseTimeSeconds") === "number"
          ? prettyTime(path(u, "responseTimeSeconds") as number)
          : null,
        listingsCount: typeof listingsCountRaw === "number" ? listingsCountRaw : null,
      };
      if (profile.name == null) warnings.push("user-profile: name missing");
      return profile;
    },
  },
  {
    name: "bare",
    detect: () => true,
    parse: (raw, warnings) => {
      warnings.push("bare: no user shape matched");
      const rawId = path(raw, "id");
      const bareId = rawId !== undefined && rawId !== null ? decodeListingId(String(rawId)) : null;
      return {
        id: bareId != null ? String(bareId) : null,
        name: (path(raw, "name") as string | null) ?? null,
        about: null, location: null, isSuperhost: null,
        responseRate: null, responseTime: null, listingsCount: null,
      };
    },
  },
];

const LISTINGS_PATH = "data.beehive.getListOfListings.listings";

export const hostListingsStrategies: ParserStrategy<{ listings: unknown[]; count: number }>[] = [
  {
    name: "beehive-listings",
    detect: (raw) => Array.isArray(path(raw, LISTINGS_PATH)),
    parse: (raw, warnings) => {
      const listings = (path(raw, LISTINGS_PATH) ?? []) as unknown[];
      if (listings.length === 0) warnings.push("beehive-listings: empty listings array");
      return { listings, count: listings.length };
    },
  },
  {
    name: "bare",
    detect: () => true,
    parse: (_raw, warnings) => {
      warnings.push("bare: no beehive shape matched");
      return { listings: [], count: 0 };
    },
  },
];

function prettyTime(seconds: number): string {
  if (seconds < 3600) return "within an hour";
  if (seconds < 86400) return "within a day";
  return "a day or more";
}

export async function parseHostProfile(raw: GetUserProfileRaw | unknown) {
  const { runParser } = await import("./registry.js");
  return runParser(hostProfileStrategies, raw as unknown);
}

export async function parseHostListings(raw: UserProfileBeehiveListingQueryRaw | unknown) {
  const { runParser } = await import("./registry.js");
  return runParser(hostListingsStrategies, raw as unknown);
}

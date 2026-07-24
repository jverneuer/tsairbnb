import { path, probe } from "../lib/get.js";
import { decodeListingId } from "../codecs/ids.js";
import type { AmenityGroup, Listing } from "../types/domain.js";
import type { ParserStrategy } from "./registry.js";

/**
 * Listing parser — the strategy registry for the details-page response.
 * Airbnb's `data.presentation.stayProductDetailPage.sections` shape is the canonical 2026
 * layout. A `bare` fallback extracts whatever sparse fields it can so a partial result
 * + warnings comes back instead of a hard failure.
 */

const EMPTY: Listing = {
  id: null,
  title: null,
  name: null,
  url: null,
  coordinates: { latitude: null, longitude: null },
  roomType: null,
  isSuperhost: null,
  homeTier: null,
  personCapacity: null,
  rating: { value: null, reviewCount: null },
  host: { id: null, name: null },
  about: null,
  description: null,
  photos: [],
  amenities: [],
  houseRules: [],
  locationDescriptions: [],
  highlights: [],
  nightlyPrice: null,
};

const SECTIONS_PATH = "data.presentation.stayProductDetailPage.sections";

export const listingStrategies: ParserStrategy<Listing>[] = [
  {
    name: "v2026-graphql",
    detect: (raw) => path(raw, SECTIONS_PATH) !== undefined,
    parse: parseV2026,
  },
  {
    name: "bare",
    detect: () => true,
    parse: (raw, warnings) => {
      const id = probe(raw, ["id", "listing.id", "data.presentation.stayProductDetailPage.id"]);
      const resolvedId = id !== undefined ? typeof id === "number" ? id : (Number(id) || null) : null;
      if (resolvedId === null) warnings.push("bare: could not find listing id");
      return { ...EMPTY, id: resolvedId };
    },
  },
];

function parseV2026(raw: unknown, warnings: string[]): Listing {
  const sections = path(raw, SECTIONS_PATH) as Record<string, unknown>;
  const ev = path(sections, "metadata.loggingContext.eventDataLogging") as Record<string, unknown> | undefined;

  let host: Listing["host"] = EMPTY.host;
  let about: Listing["about"] = null;
  let title: Listing["title"] = null;
  let description: Listing["description"] = null;
  let photos: readonly { readonly url: string; readonly caption: string | null }[] = [];
  let houseRules: readonly { readonly title: string | null; readonly values: readonly string[] }[] = [];
  let locationDescriptions: readonly { readonly title: string | null; readonly content: string | null }[] = [];
  let highlights: readonly { readonly title: string | null; readonly subtitle: string | null }[] = [];

  // Walk the sections array — multiple section types contribute fields.
  const arr = path(sections, "sections");
  if (Array.isArray(arr)) {
    for (const section of arr) {
      const type = path(section, "__typename") ?? path(section, "sectionId");
      switch (type) {
        case "HostProfileSection":
          host = {
            id: (path(section, "hostAvatar.userID") as string | null) ?? host.id,
            name: (path(section, "hostAvatar.name") as string | null) ?? host.name,
          };
          about = (path(section, "hostProfileDescription.htmlText") as string | null) ?? about;
          break;
        case "PhotoTourModalSection":
          photos = collectPhotos(path(section, "photos"));
          break;
        case "PoliciesSection":
          houseRules = collectHouseRules(path(section, "houseRules"));
          break;
        case "LocationSection":
          locationDescriptions = collectLocationDescriptions(path(section, "seeAllLocations"));
          break;
        case "PdpTitleSection":
          title = (path(section, "title") as string | null) ?? title;
          break;
        case "PdpHighlightsSection":
          highlights = collectHighlights(path(section, "highlights"));
          break;
        case "PdpDescriptionSection":
          description = (path(section, "description.htmlText") as string | null) ?? description;
          break;
      }
    }
  }

  // Amenities live under data.node, not sections.
  const amenGroups = path(raw, "data.node.pdpPresentation.amenities.seeAllAmenitiesGroups");
  const amenities: readonly AmenityGroup[] = (Array.isArray(amenGroups) ? amenGroups : []).map((g) => ({
    title: path(g, "title") as string | null,
    values: ((path(g, "values") ?? []) as unknown[]).map((v) => ({
      title: path(v, "title") as string | null,
      subtitle: path(v, "subtitle") as string | null,
      available: Boolean(path(v, "available")),
    })) as readonly { readonly title: string | null; readonly subtitle?: string | null; readonly available?: boolean }[],
  }));

  // Id: derive from a base64 demandStayListing id if present, else warn.
  let id: Listing["id"] = null;
  const b64 = probe(raw, [
    "data.presentation.stayProductDetailPage.id",
    "data.node.id",
    "listing.id",
  ]);
  if (typeof b64 === "string" && b64.length > 10) {
    const decoded = decodeListingId(b64);
    id = decoded !== null && decoded !== undefined ? decoded : (Number(b64) || null);
  }

  if (id === null) warnings.push("v2026-graphql: listing id unresolved");
  if (title === null) warnings.push("v2026-graphql: title missing");
  if (photos.length === 0) warnings.push("v2026-graphql: no photos parsed");

  return {
    ...EMPTY,
    id,
    title,
    description,
    coordinates: {
      latitude: path(ev, "listingLat") as number | null,
      longitude: path(ev, "listingLng") as number | null,
    },
    rating: {
      value: path(ev, "starRating") as number | null,
      reviewCount: path(ev, "visibleReviewCount") as number | null,
    },
    isSuperhost: path(ev, "isSuperhost") as boolean | null,
    homeTier: path(ev, "homeTier") as string | null,
    personCapacity: path(ev, "personCapacity") as number | null,
    roomType: path(ev, "roomType") as string | null,
    host,
    about,
    photos,
    amenities,
    houseRules,
    locationDescriptions,
    highlights,
  };
}

function collectPhotos(photos: unknown): readonly { readonly url: string; readonly caption: string | null }[] {
  if (!Array.isArray(photos)) return [];
  return photos
    .map((p) => ({
      url: (path(p, "picture") ?? path(p, "url")) as string,
      caption: path(p, "caption") as string | null,
    }))
    .filter((p) => p.url);
}

function collectHouseRules(rules: unknown): readonly { readonly title: string | null; readonly values: readonly string[] }[] {
  if (!rules || typeof rules !== "object") return [];
  const general = path(rules, "general");
  if (!Array.isArray(general)) return [];
  return general.map((r) => ({
    title: path(r, "title") as string | null,
    values: ((path(r, "values") ?? []) as unknown[])
      .map((v) => (typeof v === "string" ? v : path(v, "title")))
      .filter(Boolean) as string[],
  }));
}

function collectLocationDescriptions(loc: unknown): readonly { readonly title: string | null; readonly content: string | null }[] {
  if (!Array.isArray(loc)) return [];
  return loc.map((l) => ({
    title: path(l, "title") as string | null,
    content: path(l, "content") as string | null,
  }));
}

function collectHighlights(h: unknown): readonly { readonly title: string | null; readonly subtitle: string | null }[] {
  if (!Array.isArray(h)) return [];
  return h.map((x) => ({
    title: path(x, "title") as string | null,
    subtitle: path(x, "subtitle") as string | null,
  }));
}

/** Convenience: run the listing strategy registry over a raw response. */
export async function parseListing(
  raw: unknown,
): Promise<{ data: Listing; parserVersion: string; warnings: string[] } | { error: string }> {
  const { runParser } = await import("./registry.js");
  return runParser(listingStrategies, raw);
}

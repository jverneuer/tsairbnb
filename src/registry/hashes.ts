/**
 * Persisted-query SHA-256 hashes — the SINGLE SOURCE OF TRUTH.
 * Airbnb rotates these (issues #43/#56/#54). Update here, or override via config.hashOverrides.
 *
 * StaysSearch is special: its hash rotates most often, so resolveHash() falls back to a
 * dynamic webpack-scrape (see hashes-resolver.ts) when the static one 404s.
 */

export const PERSISTED_QUERIES = {
  StaysSearch: "9f945886dcc032b9ef4ba770d9132eb0aa78053296b5405483944c229617b00b",
  StaysPdpSections: "80c7889b4b0027d99ffea830f6c0d4911a6e863a957cbe1044823f0fc746bf1f",
  StaysPdpReviewsQuery: "dec1c8061483e78373602047450322fd474e79ba9afa8d3dbbc27f504030f91d",
  PdpAvailabilityCalendar: "8f08e03c7bd16fcad3c92a3592c19a8b559a0d0855a84028d1163d4733ed9ade",
  UserProfileBeehiveListingQuery: "529ca816b8be0619618d48b31bf46c379543e297fd68c0a953922927e5497b43",
  GetUserProfile: "a56d8909f271740ccfef23dd6c34d098f194f4a6e7157f244814c5610b8ad76a",
  ExperiencesSearch: "fbbf9989cdf264a11fce48073008bb557f7f6b43961ccda5df6a8d988bd6ef36",
} as const;

export type OperationName = keyof typeof PERSISTED_QUERIES;

let dynamicStaysSearch: string | null = null;

/** Resolve a hash, honoring config overrides and the dynamic StaysSearch resolver. */
export async function resolveHash(operation: OperationName): Promise<string> {
  const { getConfig } = await import("../config/load.js");
  const cfg = getConfig();
  const override = cfg.hashOverrides[operation];
  if (override) return override;

  if (operation === "StaysSearch") {
    if (dynamicStaysSearch) return dynamicStaysSearch;
    const { fetchStaysSearchHash } = await import("./hashes-resolver.js");
    dynamicStaysSearch = await fetchStaysSearchHash();
    return dynamicStaysSearch;
  }

  return PERSISTED_QUERIES[operation];
}

/** Build the extensions JSON every GraphQL call embeds. */
export function extensions(operation: OperationName, hash: string) {
  return { persistedQuery: { version: 1, sha256Hash: hash } };
}

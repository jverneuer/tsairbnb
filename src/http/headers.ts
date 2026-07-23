import { getConfig, rotateUserAgent } from "../config/load.js";

/**
 * Two header presets, matching pyairbnb exactly:
 *  - browser: for HTML scrapes (homepage, listing page) — full browser navigation headers.
 *  - graphql: for JSON GraphQL/REST calls — X-Airbnb-Api-Key injected by callers.
 *
 * Both carry the rotated UA from config.
 */

export function browserHeaders(language = "en"): Record<string, string> {
  return {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": language,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": rotateUserAgent(),
  };
}

export function graphqlHeaders(apiKey: string): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": rotateUserAgent(),
    "X-Airbnb-Api-Key": apiKey,
  };
}

/** Pick a proxy from the configured pool (deterministic-by-day rotation). */
export function pickProxy(): string | undefined {
  const { proxies } = getConfig();
  if (proxies.length === 0) return undefined;
  if (proxies.length === 1) return proxies[0];
  const seed = Number(process.env.TSAIRBNB_PROXY_SEED ?? Math.floor(Date.now() / 86_400_000));
  return proxies[seed % proxies.length];
}

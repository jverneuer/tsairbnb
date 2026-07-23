import { emit } from "../telemetry.js";
import type { Envelope } from "../types/envelope.js";
import type { ExperienceHit } from "../parsers/experience.js";
import { getMarkets } from "./get-markets.js";
import { getPlacesIds } from "./get-places-ids.js";
import { experienceSearchByPlaceId } from "./experience-search-by-place-id.js";
import { getConfig } from "../config/load.js";

/**
 * experience-search — orchestration: markets -> places -> search. Ports pyairbnb's experience.py.
 * Takes the first market's satori_parameters + country_code, then the first place's google_place_id.
 */

export type ExperienceSearchMode =
  | { mode: "live"; userInputText: string; apiKey: string; checkIn?: string; checkOut?: string; currency?: string; locale?: string }
  | { mode: "reprocess"; raw: unknown };

export async function experienceSearch(opts: ExperienceSearchMode): Promise<Envelope<ExperienceHit[]>> {
  if (opts.mode === "reprocess") {
    const { parseExperience } = await import("../parsers/experience.js");
    const parsed = await parseExperience(opts.raw);
    if ("error" in parsed) return { ok: false, error: parsed.error, code: "parse" };
    return { ok: true, data: parsed.data.hits, raw: opts.raw, meta: { fetchedAt: null, endpoint: "experience-search", durationMs: 0, parserVersion: parsed.parserVersion, warnings: parsed.warnings, mode: "reprocess" } };
  }

  const warnings: string[] = [];
  const currency = opts.currency ?? getConfig().currency;
  const locale = opts.locale ?? getConfig().locale;

  // 1. markets -> first market
  const markets = await getMarkets({ mode: "live", apiKey: opts.apiKey });
  if (!markets.ok) return markets as any;
  const firstMarket = (markets.data as any[])[0];
  if (!firstMarket) return { ok: false, error: "no markets returned", code: "parse" };
  const configToken = firstMarket.satori_parameters ?? firstMarket.configToken;
  const countryCode = firstMarket.country_code ?? firstMarket.countryCode;
  if (!configToken || !countryCode) return { ok: false, error: "market missing satori_parameters or country_code", code: "parse" };

  // 2. places -> first place
  const places = await getPlacesIds({ mode: "live", country: countryCode, locationName: opts.userInputText, apiKey: opts.apiKey, configToken });
  if (!places.ok) return places as any;
  const firstPlace = (places.data as any[])[0];
  if (!firstPlace) return { ok: false, error: "no places returned", code: "parse" };
  const placeId = firstPlace.location?.google_place_id ?? firstPlace.google_place_id;
  const locationName = firstPlace.location?.location_name ?? firstPlace.location_name;
  if (!placeId) return { ok: false, error: "place missing google_place_id", code: "parse" };

  // 3. search by place id, paginate
  const all: ExperienceHit[] = [];
  let cursor: string | null = null;
  const maxPages = getConfig().maxPages;
  for (let page = 0; page < maxPages; page++) {
    const result = await experienceSearchByPlaceId({
      mode: "live",
      placeId,
      locationName,
      currency,
      locale,
      checkIn: opts.checkIn ?? "",
      checkOut: opts.checkOut ?? "",
      apiKey: opts.apiKey,
      cursor,
    });
    if (!result.ok) return result as any;
    all.push(...result.data.hits);
    cursor = result.data.nextCursor;
    if (!cursor) break;
  }

  emit({ t: "parse", endpoint: "experience-search", parserVersion: "experiences-search", warnings, durationMs: 0 });
  return { ok: true, data: all, raw: null, meta: { fetchedAt: new Date().toISOString(), endpoint: "experience-search", durationMs: 0, parserVersion: "experiences-search", warnings, mode: "live" } };
}

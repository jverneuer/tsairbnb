import type { ExperienceHit } from "../parsers/experience.js";
import { experiencesSearchRaw } from "../parsers/raw.js";
import { parseExperience } from "../parsers/experience.js";
import { createEndpoint } from "../lib/endpoint.js";

/**
 * experience-search-by-place-id — single-page ExperiencesSearch. Ports pyairbnb's experience.py.
 * Returns [results, nextCursor]. POST.
 */

export type ExperienceByPlaceMode =
  | { mode: "live"; placeId: string; locationName: string; currency: string; locale: string; checkIn: string; checkOut: string; apiKey: string; cursor?: string | null }
  | { mode: "reprocess"; raw: unknown };

export const experienceSearchByPlaceId = createEndpoint<
  { readonly hits: readonly ExperienceHit[]; readonly nextCursor: string | null },
  typeof experiencesSearchRaw,
  Extract<ExperienceByPlaceMode, { mode: "live" }>
>({
  operation: "ExperiencesSearch",
  method: "POST",
  rawSchema: experiencesSearchRaw,
  parse: parseExperience,
  name: "experience-search-by-place-id",
  getApiKey: (opts) => opts.apiKey,
  getLocale: (opts) => opts.locale,
  getCurrency: (opts) => opts.currency,
  buildVariables: (opts) => ({
    request: {
      placeId: opts.placeId,
      locationName: opts.locationName,
      cursor: opts.cursor ?? undefined,
      checkIn: opts.checkIn ?? undefined,
      checkOut: opts.checkOut ?? undefined,
    },
  }),
});

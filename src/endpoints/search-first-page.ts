import type { Envelope } from "../types/envelope.js";
import type { SearchHit } from "../types/domain.js";
import { staysSearchRaw } from "../parsers/raw.js";
import { parseSearch } from "../parsers/search.js";
import { buildVariablesPublic, type SearchAllVariables } from "./search-all.js";
import { createEndpoint } from "../lib/endpoint.js";

/**
 * search-first-page — single page of StaysSearch. Ports pyairbnb's start.py.
 * Wraps the same variable builder as search-all but returns just { hits, nextCursor }.
 */

export type SearchFirstPageMode =
  | { mode: "live"; apiKey: string; variables: SearchAllVariables; currency?: string; language?: string }
  | { mode: "reprocess"; raw: unknown };

export const searchFirstPage = createEndpoint<
  { readonly hits: readonly SearchHit[]; readonly nextCursor: string | null },
  typeof staysSearchRaw,
  Extract<SearchFirstPageMode, { mode: "live" }>
>({
  operation: "StaysSearch",
  method: "POST",
  rawSchema: staysSearchRaw,
  parse: parseSearch,
  name: "search-first-page",
  getApiKey: (opts) => opts.apiKey,
  getLocale: (opts) => opts.language,
  getCurrency: (opts) => opts.currency,
  buildVariables: (opts) => buildVariablesPublic(opts.variables, null),
});

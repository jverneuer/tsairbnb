import type { HostProfile } from "../types/domain.js";
import { getUserProfileRaw } from "../parsers/raw.js";
import { parseHostProfile } from "../parsers/host.js";
import { encodeHostId } from "../codecs/ids.js";
import { createEndpoint } from "../lib/endpoint.js";

/**
 * get-host-details — GetUserProfile. Ports pyairbnb's host_details.py.
 * host_id is base64("User:<id>"). cookies param is accepted but unused (matches pyairbnb).
 */

export type GetHostDetailsMode =
  | { mode: "live"; hostId: string; apiKey: string; language?: string }
  | { mode: "reprocess"; raw: unknown };

export const getHostDetails = createEndpoint<HostProfile, typeof getUserProfileRaw, Extract<GetHostDetailsMode, { mode: "live" }>>({
  operation: "GetUserProfile",
  method: "GET",
  rawSchema: getUserProfileRaw,
  parse: parseHostProfile,
  name: "get-host-details",
  getApiKey: (opts) => opts.apiKey,
  getLocale: (opts) => opts.language,
  buildVariables: (opts) => ({ userId: encodeHostId(opts.hostId) }),
});

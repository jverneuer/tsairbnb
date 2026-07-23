import { getClient } from "../http/curl-impersonate.js";
import { withRetry } from "../http/retry.js";
import { emit } from "../telemetry.js";
import { getConfig } from "../config/load.js";
import type { EnvelopeErr, ParseMeta } from "../types/envelope.js";

/**
 * Shared live-fetch helper: GET a URL, parse JSON, track telemetry, build the meta block.
 * Returns the raw parsed JSON (caller passes it through the parser) and the meta baseline.
 */
export async function fetchJson(
  url: string,
  headers: Record<string, string>,
  endpoint: string,
): Promise<{ raw: unknown; meta: Pick<ParseMeta, "fetchedAt" | "durationMs" | "endpoint"> } | EnvelopeErr> {
  const t0 = Date.now();
  const res = await withRetry(
    async () => {
      const r = await getClient().request({ url, headers });
      return { status: r.status, value: r };
    },
    { endpoint },
  );

  emit({ t: "http", endpoint, status: res.status, durationMs: Date.now() - t0 });
  if (res.status === 403) {
    emit({ t: "block", endpoint, reason: "http-403" });
    return { ok: false, error: "blocked: Airbnb returned 403 (TLS fingerprint likely flagged)", code: "block" };
  }
  if (res.status < 200 || res.status >= 300) {
    return { ok: false, error: `http ${res.status}`, code: `http-${res.status}` };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(res.value.body);
  } catch {
    return { ok: false, error: "response was not JSON", code: "parse" };
  }
  return {
    raw,
    meta: { fetchedAt: new Date().toISOString(), durationMs: Date.now() - t0, endpoint },
  };
}

/** Build the full meta block from the baseline + parser output. */
export function buildMeta(
  base: Pick<ParseMeta, "fetchedAt" | "durationMs" | "endpoint">,
  extra: { parserVersion: string; warnings: string[]; mode: "live" | "reprocess"; apikey?: string },
): ParseMeta {
  return { ...base, ...extra };
}

export { getConfig };

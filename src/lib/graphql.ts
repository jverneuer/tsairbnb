import { z } from "zod";
import { getClient } from "../http/curl-impersonate.js";
import { graphqlHeaders } from "../http/headers.js";
import { emit } from "../telemetry.js";
import { resolveHash, extensions, type OperationName } from "../registry/hashes.js";
import { getConfig } from "../config/load.js";

/**
 * Shared GraphQL call helper. Builds the persisted-query URL + extensions, runs the
 * request, and validates the raw response against an optional Zod schema. Both
 * GET (price/reviews/calendar/host) and POST (StaysSearch, ExperiencesSearch)
 * go through here.
 */
export async function graphqlCall<T extends z.ZodTypeAny>(
  operation: OperationName,
  variables: Record<string, unknown>,
  apiKey: string,
  opts: { method?: "GET" | "POST"; locale?: string; currency?: string; rawSchema?: T } = {},
): Promise<{ data: z.infer<T>; raw: unknown } | { error: string; code: string }> {
  const { method = "GET", locale = getConfig().locale, currency = getConfig().currency, rawSchema } = opts;
  const hash = await resolveHash(operation);
  const ext = extensions(operation, hash);
  const qs = new URLSearchParams({
    operationName: operation,
    locale,
    currency,
    variables: JSON.stringify(variables),
    extensions: JSON.stringify(ext),
  });

  const url = `https://www.airbnb.com/api/v3/${operation}/${hash}?${qs}`;
  const headers = graphqlHeaders(apiKey);

  const t0 = Date.now();
  const res =
    method === "POST"
      ? await getClient().request({
          url,
          method: "POST",
          headers,
          body: JSON.stringify({ operationName: operation, variables, extensions: ext }),
        })
      : await getClient().request({ url, headers });

  emit({ t: "http", endpoint: operation, status: res.status, durationMs: Date.now() - t0 });
  if (res.status === 403) {
    emit({ t: "block", endpoint: operation, reason: "http-403" });
    return { error: "blocked: 403", code: "block" };
  }
  if (res.status < 200 || res.status >= 300) {
    return { error: `http ${res.status}`, code: `http-${res.status}` };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(res.body);
  } catch {
    return { error: "response was not JSON", code: "parse" };
  }

  if (rawSchema) {
    const parsed = rawSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: `raw response failed validation: ${parsed.error.message}`, code: "parse" };
    }
    return { data: parsed.data, raw };
  }

  const data = (raw as { data?: unknown }).data;
  if (data === undefined) {
    return { error: "no data field in response", code: "parse" };
  }
  return { data: data as z.infer<T>, raw };
}

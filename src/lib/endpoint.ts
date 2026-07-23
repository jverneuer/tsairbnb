/**
 * Endpoint factory — eliminates the reprocess/live envelope boilerplate shared by
 * every graphqlCall-based endpoint. Single-call endpoints use createEndpoint;
 * paginated endpoints use createPaginatedEndpoint. Endpoints that don't go through
 * graphqlCall (homepage scrape, REST v2, webpack scrape, aggregators) stay hand-written.
 */
import type { z } from "zod";
import type { Envelope } from "../types/envelope.js";
import { graphqlCall } from "./graphql.js";
import { emit } from "../telemetry.js";
import { getConfig } from "../config/load.js";
import type { OperationName } from "../registry/hashes.js";

export interface EndpointConfig<TPublic, TRaw extends z.ZodTypeAny, TLiveOpts extends { mode: "live" }> {
  operation: string;
  method: "GET" | "POST";
  rawSchema: TRaw;
  parse: (raw: unknown) => Promise<{ data: TPublic; parserVersion: string; warnings: string[] } | { error: string }>;
  name: string;
  buildVariables: (opts: TLiveOpts) => Record<string, unknown>;
  getApiKey: (opts: TLiveOpts) => string;
  getLocale?: (opts: TLiveOpts) => string | undefined;
  getCurrency?: (opts: TLiveOpts) => string | undefined;
}

export function createEndpoint<TPublic, TRaw extends z.ZodTypeAny, TLiveOpts extends { mode: "live" }>(
  config: EndpointConfig<TPublic, TRaw, TLiveOpts>,
) {
  return async (opts: TLiveOpts | { mode: "reprocess"; raw: unknown }): Promise<Envelope<TPublic>> => {
    if (opts.mode === "reprocess") {
      const result = await config.parse(opts.raw);
      if ("error" in result) return { ok: false, error: result.error, code: "parse" };
      return {
        ok: true,
        data: result.data,
        raw: opts.raw,
        meta: { fetchedAt: null, endpoint: config.name, durationMs: 0, parserVersion: result.parserVersion, warnings: result.warnings, mode: "reprocess" as const },
      };
    }

    const apiKey = config.getApiKey(opts);
    const variables = config.buildVariables(opts);
    const locale = config.getLocale?.(opts);
    const currency = config.getCurrency?.(opts);

    const callOpts: Parameters<typeof graphqlCall>[3] = {
      method: config.method,
      rawSchema: config.rawSchema,
      ...(locale !== undefined ? { locale } : {}),
      ...(currency !== undefined ? { currency } : {}),
    };
    const res = await graphqlCall(config.operation as OperationName, variables, apiKey, callOpts);

    if ("error" in res) return { ok: false, error: res.error, code: res.code };

    const parsed = await config.parse(res.raw);
    if ("error" in parsed) return { ok: false, error: parsed.error, code: "parse" };
    emit({ t: "parse", endpoint: config.name, parserVersion: parsed.parserVersion, warnings: parsed.warnings, durationMs: 0 });
    return {
      ok: true,
      data: parsed.data,
      raw: res.raw,
      meta: { fetchedAt: new Date().toISOString(), endpoint: config.name, durationMs: 0, parserVersion: parsed.parserVersion, warnings: parsed.warnings, mode: "live" as const },
    };
  };
}

export interface PaginatedEndpointConfig<TPublic, TItem, TRaw extends z.ZodTypeAny, TLiveOpts extends { mode: "live" }> {
  operation: string;
  method: "GET" | "POST";
  rawSchema: TRaw;
  parse: (raw: unknown) => Promise<{ data: TPublic; parserVersion: string; warnings: string[] } | { error: string }>;
  name: string;
  buildVariables: (opts: TLiveOpts, page: number, cursor: string | null) => Record<string, unknown>;
  getApiKey: (opts: TLiveOpts) => string;
  extractItems: (data: TPublic) => readonly TItem[];
  /** Return next cursor, or null to stop. */
  getNextCursor: (data: TPublic) => string | null;
  /** Alternative stop condition: return true when the page signals "no more data". */
  shouldStop?: (data: TPublic, page: number) => boolean;
  getLocale?: (opts: TLiveOpts) => string | undefined;
  getCurrency?: (opts: TLiveOpts) => string | undefined;
}

export function createPaginatedEndpoint<TPublic, TItem, TRaw extends z.ZodTypeAny, TLiveOpts extends { mode: "live" }>(
  config: PaginatedEndpointConfig<TPublic, TItem, TRaw, TLiveOpts>,
) {
  return async (opts: TLiveOpts | { mode: "reprocess"; raw: unknown }): Promise<Envelope<readonly TItem[]>> => {
    if (opts.mode === "reprocess") {
      const result = await config.parse(opts.raw);
      if ("error" in result) return { ok: false, error: result.error, code: "parse" };
      return {
        ok: true,
        data: config.extractItems(result.data),
        raw: opts.raw,
        meta: { fetchedAt: null, endpoint: config.name, durationMs: 0, parserVersion: result.parserVersion, warnings: result.warnings, mode: "reprocess" as const },
      };
    }

    const apiKey = config.getApiKey(opts);
    const locale = config.getLocale?.(opts);
    const currency = config.getCurrency?.(opts);
    const maxPages = getConfig().maxPages;
    const all: TItem[] = [];
    const warnings: string[] = [];
    let cursor: string | null = null;
    let parserVersion = config.name;

    for (let page = 0; page < maxPages; page++) {
      const variables = config.buildVariables(opts, page, cursor);
      const callOpts: Parameters<typeof graphqlCall>[3] = {
        method: config.method,
        rawSchema: config.rawSchema,
        ...(locale !== undefined ? { locale } : {}),
        ...(currency !== undefined ? { currency } : {}),
      };
      const res = await graphqlCall(config.operation as OperationName, variables, apiKey, callOpts);
      if ("error" in res) return { ok: false, error: res.error, code: res.code };

      const parsed = await config.parse(res.raw);
      if ("error" in parsed) return { ok: false, error: parsed.error, code: "parse" };
      warnings.push(...parsed.warnings);
      parserVersion = parsed.parserVersion;
      all.push(...config.extractItems(parsed.data));
      if (config.shouldStop?.(parsed.data, page)) break;
      cursor = config.getNextCursor(parsed.data);
      if (cursor === null) break;
    }

    emit({ t: "parse", endpoint: config.name, parserVersion, warnings, durationMs: 0 });
    return {
      ok: true,
      data: all,
      raw: null,
      meta: { fetchedAt: new Date().toISOString(), endpoint: config.name, durationMs: 0, parserVersion, warnings, mode: "live" as const },
    };
  };
}

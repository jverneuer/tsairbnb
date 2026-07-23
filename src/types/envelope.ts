/** The standard result envelope. Every endpoint returns one. Always JSON. */

export interface ParseMeta {
  /** ISO timestamp the live fetch happened, or null in reprocess mode. */
  fetchedAt: string | null;
  /** Endpoint name (e.g. "get-details"). */
  endpoint: string;
  /** Wall-clock ms for the live fetch (0 in reprocess mode). */
  durationMs: number;
  /** Which parser variant handled this (e.g. "v2026-graphql", "bare"). */
  parserVersion: string;
  /** Soft degradations: fields that moved / probed paths that missed. Non-fatal. */
  warnings: string[];
  /** Live or reprocess. */
  mode: "live" | "reprocess";
}

export type EnvelopeOk<T> = {
  ok: true;
  data: T;
  /** Original upstream document — keep it so captures can be reprocessed later. */
  raw: unknown;
  meta: ParseMeta;
};

export type EnvelopeErr = {
  ok: false;
  /** Human-readable failure reason. */
  error: string;
  /** Stable machine code (e.g. "no-strategy-matched", "http-403", "block"). */
  code: string;
  /** Original document if we got one before failing. */
  raw?: unknown;
  meta?: Partial<ParseMeta>;
};

export type Envelope<T> = EnvelopeOk<T> | EnvelopeErr;

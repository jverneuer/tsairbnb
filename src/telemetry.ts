/**
 * Plugin sink: every parse / http / block event is emitted here.
 * Core stays decoupled from any one sink (CloudWatch, console, external API).
 * Importantly: when a parser returns mostly-undefined fields (early churn signal),
 * the high warning count surfaces here so an alert can fire before users notice.
 */

export type TelemetryEvent =
  | { t: "parse"; endpoint: string; parserVersion: string; warnings: string[]; durationMs: number }
  | { t: "http"; endpoint: string; status: number; durationMs: number }
  | { t: "block"; endpoint: string; reason: string };

type Sink = (e: TelemetryEvent) => void;

const sinks = new Set<Sink>();

/** Attach a sink. Returns a detach function. */
export function onEvent(sink: Sink): () => void {
  sinks.add(sink);
  return () => sinks.delete(sink);
}

export function emit(e: TelemetryEvent): void {
  for (const s of sinks) {
    try {
      s(e);
    } catch {
      // a failing sink must never break a request
    }
  }
}

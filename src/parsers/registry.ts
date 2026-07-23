/**
 * Generic parser strategy registry — the generalization of pyairbnb's "try 4 regexes".
 * Each endpoint registers multiple parser variants keyed by a shape detector.
 * At runtime we detect which shape Airbnb returned and pick the matching parser;
 * if none matches, the last "bare" fallback runs. First detect-match wins.
 *
 * Parsers are pure: (raw, warnings) => data. No network. Fully unit-testable.
 */

export interface ParserStrategy<T> {
  name: string;
  /** Return true if this parser can handle the given shape. Must not throw. */
  detect: (raw: unknown) => boolean;
  /** Extract domain data. Pushes soft warnings into the array. */
  parse: (raw: unknown, warnings: string[]) => T;
}

export function runParser<T>(
  strategies: ParserStrategy<T>[],
  raw: unknown,
): { data: T; parserVersion: string; warnings: string[] } | { error: string } {
  const warnings: string[] = [];
  for (const strat of strategies) {
    let matched = false;
    try {
      matched = strat.detect(raw);
    } catch {
      matched = false;
    }
    if (!matched) continue;
    try {
      const data = strat.parse(raw, warnings);
      return { data, parserVersion: strat.name, warnings };
    } catch (e) {
      warnings.push(`${strat.name}: parse threw: ${(e as Error).message}`);
      // fall through to next strategy
    }
  }
  return { error: "no-strategy-matched" };
}

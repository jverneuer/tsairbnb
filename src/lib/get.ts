/**
 * Dotted-path traversal that returns undefined on missing keys — never throws.
 * Mirrors pyairbnb's `get_nested_value`. The foundation of churn-tolerant parsing.
 */
export function path(obj: unknown, dotpath: string, fallback: unknown = undefined): unknown {
  const out = dotpath
    .split(".")
    .reduce<unknown>(
      (acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]),
      obj,
    );
  return out === undefined || out === null ? fallback : out;
}

/** Try a list of candidate paths; return the first non-undefined hit. */
export function probe(obj: unknown, paths: string[]): unknown {
  for (const p of paths) {
    const v = path(obj, p);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/**
 * Type-safe index into an array, returning undefined when out of range.
 * Required under noUncheckedIndexedAccess.
 */
export function at<T>(arr: readonly T[] | undefined, i: number): T | undefined {
  if (!arr || i < 0 || i >= arr.length) return undefined;
  return arr[i];
}

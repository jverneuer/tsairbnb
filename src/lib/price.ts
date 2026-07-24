import type { Money, Rating } from "../types/domain.js";

/**
 * Price-string parsing — ports pyairbnb's parse_price_symbol, with the #61 decimal bug fixed.
 * Airbnb ships prices like "$1,234.56", "€34,99", "1.234,56 €". Extract the numeric amount
 * and the currency symbol separately, locale-agnostic. Returns our Money type (symbol -> currency).
 */

const NUMERIC_RE = /\d+(?:[.,]\d+)*/;

/** Extract Money from a price string. Returns null on no number found. */
export function parsePriceString(s: string | undefined | null): Money | null {
  if (!s || typeof s !== "string") return null;
  const numMatch = s.match(NUMERIC_RE);
  if (!numMatch) return null;
  const raw = numMatch[0]!;
  const symbol = s.replace(raw, "").trim();

  // Heuristic: if both separators present, the rightmost is the decimal separator.
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  let amount: number;
  if (hasComma && hasDot) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
      // European: 1.234,56
      amount = Number(raw.replace(/\./g, "").replace(",", "."));
    } else {
      // US: 1,234.56
      amount = Number(raw.replace(/,/g, ""));
    }
  } else if (hasComma) {
    // Comma only — treat as decimal (€34,99) unless it's a thousands group (3 digits after, exactly)
    // hasComma guarantees split returns ≥2 elements, so [1] is always a string.
    const after = raw.split(",")[1];
    amount = after.length === 3 ? Number(raw.replace(/,/g, "")) : Number(raw.replace(",", "."));
  } else {
    amount = Number(raw);
  }

  return { amount, currency: symbol || null };
}

/** Split "4.9 (19 reviews)" → Rating. */
export function parseRatingString(s: string | undefined | null): Rating | null {
  if (!s || typeof s !== "string") return null;
  const parts = s.split(/\s+/);
  const rating = Number(parts[0]!.replace(",", "."));
  if (Number.isNaN(rating)) return null;
  const countMatch = parts.slice(1).join(" ").match(/\d+/);
  const reviewCount = countMatch ? Number(countMatch[0]) : 0;
  return { value: rating, reviewCount: reviewCount || null };
}

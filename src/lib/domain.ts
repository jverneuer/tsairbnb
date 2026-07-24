/**
 * Airbnb regional domain support.
 *
 * Airbnb operates dozens of country-specific domains (airbnb.fr, airbnb.de, airbnb.ie, …).
 * Lambda IPs are geolocated by Cloudflare, causing domain-switch redirects that return HTML
 * instead of JSON. Callers can request a specific domain via `?domain=airbnb.ie`, or the system
 * follows redirects and reports the effective domain in the response envelope.
 *
 * Each domain has a default locale and accept-language. Currency always defaults to EUR
 * unless overridden by the caller.
 */

/** Known Airbnb regional domains mapped to their default locale. */
const DOMAIN_LOCALES: Record<string, string> = {
  // Europe
  "airbnb.at": "de",
  "airbnb.be": "nl",
  "fr.airbnb.be": "fr",
  "airbnb.ba": "bs",
  "airbnb.cz": "cs",
  "airbnb.dk": "da",
  "airbnb.fi": "fi",
  "airbnb.fr": "fr",
  "airbnb.de": "de",
  "airbnb.gr": "el",
  "airbnb.hu": "hu",
  "airbnb.is": "is",
  "airbnb.ie": "en",
  "ga.airbnb.ie": "ga",
  "airbnb.it": "it",
  "airbnb.me": "sr",
  "airbnb.nl": "nl",
  "airbnb.no": "no",
  "airbnb.pl": "pl",
  "airbnb.pt": "pt",
  "airbnb.ru": "ru",
  "airbnb.rs": "sr",
  "airbnb.es": "es",
  "airbnb.cat": "ca",
  "airbnb.se": "sv",
  "airbnb.ch": "de",
  "fr.airbnb.ch": "fr",
  "it.airbnb.ch": "it",
  "airbnb.co.uk": "en",
  // The Americas
  "airbnb.com.ar": "es",
  "airbnb.com.bz": "en",
  "airbnb.com.bo": "es",
  "airbnb.com.br": "pt",
  "airbnb.ca": "en",
  "fr.airbnb.ca": "fr",
  "airbnb.cl": "es",
  "airbnb.com.co": "es",
  "airbnb.co.cr": "es",
  "airbnb.com.ec": "es",
  "airbnb.com.sv": "es",
  "airbnb.com.gt": "es",
  "airbnb.gy": "en",
  "airbnb.com.hn": "es",
  "airbnb.mx": "es",
  "airbnb.com.ni": "es",
  "airbnb.com.pa": "es",
  "airbnb.com.py": "es",
  "airbnb.com.pe": "es",
  "airbnb.co.ve": "es",
  // Asia & Pacific
  "airbnb.com.au": "en",
  "airbnb.am": "hy",
  "airbnb.az": "az",
  "airbnb.cn": "zh",
  "airbnb.com.hk": "en",
  "airbnb.co.in": "en",
  "hi.airbnb.co.in": "hi",
  "airbnb.co.id": "id",
  "airbnb.jp": "ja",
  "airbnb.com.my": "ms",
  "airbnb.co.nz": "en",
  "airbnb.com.ph": "en",
  "airbnb.com.sg": "en",
  "airbnb.co.kr": "ko",
  "airbnb.com.tw": "zh",
  "airbnb.com.vn": "vi",
  // Middle East & Africa
  "airbnb.ae": "ar",
  "zu.airbnb.co.za": "zu",
  "xh.airbnb.co.za": "xh",
  // Subdomain-based
  "ar.airbnb.com": "ar",
  "sw.airbnb.com": "sw",
  "sq.airbnb.com": "sq",
  "bg.airbnb.com": "bg",
  "hr.airbnb.com": "hr",
  "he.airbnb.com": "he",
  "th.airbnb.com": "th",
  "airbnb.com.tr": "tr",
  "airbnb.com.ua": "uk",
  // Default
  "airbnb.com": "en",
};

/** All known domain keys. */
export const KNOWN_DOMAINS = Object.keys(DOMAIN_LOCALES);

/** Accept-Language for a given locale code. */
function acceptLanguage(locale: string): string {
  return `${locale},en;q=0.9`;
}

/**
 * Validate a domain string against the known set.
 * Returns the domain if valid, throws an error otherwise.
 */
export function validateDomain(domain: string): string {
  const d = domain.toLowerCase().trim();
  if (!KNOWN_DOMAINS.includes(d)) {
    throw new Error(
      `Unknown domain: "${domain}". Must be one of: ${KNOWN_DOMAINS.join(", ")}`,
    );
  }
  return d;
}

/**
 * Get locale defaults for a given domain.
 * Returns the domain-specific locale and accept-language header.
 */
export function domainDefaults(domain: string): { locale: string; acceptLanguage: string } {
  const locale = DOMAIN_LOCALES[domain] ?? "en";
  return { locale, acceptLanguage: acceptLanguage(locale) };
}

/**
 * Build the base URL for a given domain.
 * Defaults to https://www.airbnb.com if no domain specified.
 */
export function baseUrl(domain?: string): string {
  const d = domain ?? "airbnb.com";
  return `https://www.${d}`;
}

/**
 * Extract the domain from a full URL.
 * Returns undefined if not an Airbnb URL.
 */
export function extractDomain(url: string): string | undefined {
  try {
    const host = new URL(url).hostname;
    // Strip "www." prefix
    const clean = host.replace(/^www\./, "");
    if (KNOWN_DOMAINS.includes(clean)) return clean;
    // Check subdomain patterns like ar.airbnb.com
    if (clean.endsWith(".airbnb.com") && KNOWN_DOMAINS.includes(clean)) return clean;
    return undefined;
  } catch {
    return undefined;
  }
}

/** Domain types — OUR shapes, not Airbnb's. Parsers translate Airbnb blobs into these. */

export interface Coordinates {
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface Money {
  readonly amount: number | null;
  /** Currency symbol or code, e.g. "$", "€", "USD". */
  readonly currency: string | null;
}

// parsePriceString (lib/price.ts) returns Money directly (symbol -> currency).

export interface Rating {
  readonly value: number | null;
  readonly reviewCount: number | null;
}

// parseRatingString (lib/price.ts) returns Rating directly (rating -> value).

export interface HostRef {
  readonly id: string | null;
  readonly name: string | null;
}

export interface Photo {
  readonly url: string;
  readonly caption?: string | null;
}

export interface AmenityGroup {
  readonly title: string | null;
  readonly values: readonly { readonly title: string | null; readonly subtitle?: string | null; readonly available?: boolean }[];
}

export interface Listing {
  readonly id: number | null;
  readonly title: string | null;
  readonly name: string | null;
  readonly url: string | null;
  readonly coordinates: Coordinates;
  readonly roomType: string | null;
  readonly isSuperhost: boolean | null;
  readonly homeTier: string | null;
  readonly personCapacity: number | null;
  readonly rating: Rating;
  readonly host: HostRef;
  readonly about: string | null;
  readonly description: string | null;
  readonly photos: readonly Photo[];
  readonly amenities: readonly AmenityGroup[];
  readonly houseRules: readonly { readonly title: string | null; readonly values: readonly string[] }[];
  readonly locationDescriptions: readonly { readonly title: string | null; readonly content: string | null }[];
  readonly highlights: readonly { readonly title: string | null; readonly subtitle: string | null }[];
  readonly nightlyPrice: Money | null;
}

export interface Review {
  readonly id: string | null;
  readonly rating: number | null;
  readonly createdAt: string | null;
  readonly reviewer: { readonly name: string | null; readonly id: string | null } | null;
  readonly text: string | null;
  readonly language: string | null;
  readonly responses: readonly { readonly member: { readonly name: string | null } | null; readonly response: string | null }[];
}

export interface CalendarMonth {
  readonly month: number | null;
  readonly year: number | null;
  readonly days: readonly {
    readonly date: string;
    readonly available: boolean;
    readonly price: Money | null;
    readonly minNights: number | null;
  }[];
}

export interface HostProfile {
  readonly id: string | null;
  readonly name: string | null;
  readonly about: string | null;
  readonly location: string | null;
  readonly isSuperhost: boolean | null;
  readonly responseRate: number | null;
  readonly responseTime: string | null;
  readonly listingsCount: number | null;
}

export interface SearchHit {
  readonly roomId: number | null;
  readonly title: string | null;
  readonly name: string | null;
  readonly coordinates: Coordinates;
  readonly rating: Rating;
  readonly badges: readonly string[];
  readonly images: readonly string[];
  readonly price: { readonly unit: Money | null; readonly discount: string | null; readonly total: string | null } | null;
}

export interface PriceQuote {
  readonly main: {
    readonly price: Money | null;
    readonly discountedPrice: Money | null;
    readonly originalPrice: Money | null;
    readonly qualifier: string | null;
    readonly details: Readonly<Record<string, string>>;
  };
  readonly available: boolean;
}

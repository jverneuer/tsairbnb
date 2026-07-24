# tsairbnb API Reference

TypeScript port of pyairbnb — deployed as Lambda containers behind CloudFront. Scrapes Airbnb listings, search results, reviews, calendar, pricing, and experiences. Uses curl-impersonate for TLS fingerprint matching.

## Request Format

All endpoints are GET requests with query-string parameters. POST body supported for `raw` in reprocess mode.

```
GET /?endpoint=<name>&key1=value1&key2=value2
```

### Common Parameters (all endpoints)

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `endpoint` | string | — | **Required.** Endpoint name. |
| `mode` | `"live"` \| `"reprocess"` | `"live"` | `live` = fetch from Airbnb. `reprocess` = re-parse existing `raw`. |
| `raw` | JSON (URL-encoded or POST body) | — | **Required for reprocess mode.** Original upstream document. |
| `domain` | string | `"airbnb.com"` | Airbnb regional domain (e.g. `airbnb.ie`, `airbnb.fr`, `airbnb.co.uk`). 60+ domains supported. |

### Global Query Params (any endpoint)

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `language` | string | `"en"` | Language locale for the request. |
| `currency` | string | `"USD"` | Currency code. |

## Response Envelope

Every response is JSON with this structure:

### Success
```json
{
  "ok": true,
  "data": { ... },
  "raw": "original upstream document (for reprocess)",
  "meta": {
    "fetchedAt": "2026-07-24T10:00:00.000Z",
    "endpoint": "get-details",
    "durationMs": 1234,
    "parserVersion": "v2026-graphql",
    "warnings": ["optional warnings"],
    "mode": "live",
    "respondedDomain": "airbnb.ie"
  }
}
```

### Error
```json
{
  "ok": false,
  "error": "human-readable error message",
  "code": "input|parse|block|http-301|http-403|handler-threw",
  "meta": { ... }
}
```

### Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `input` | 400 | Invalid parameters or missing required fields. |
| `block` | 403 | Blocked by Airbnb (403 response). |
| `parse` | 502 | Response received but parsing failed. |
| `http-{status}` | 502 | Non-200 HTTP status from upstream. |
| `handler-threw` | 502 | Unhandled exception in handler. |

### Meta Fields

| Field | Type | Description |
|-------|------|-------------|
| `fetchedAt` | `string \| null` | ISO 8601 timestamp. `null` in reprocess mode. |
| `endpoint` | `string` | Endpoint name that handled the request. |
| `durationMs` | `number` | Wall-clock time in milliseconds. |
| `parserVersion` | `string` | Parser used (`"v2026-graphql"`, `"deferred-state"`, `"bare"`, `"passthrough"`, `"none"`). |
| `warnings` | `string[]` | Non-fatal issues encountered. |
| `mode` | `"live" \| "reprocess"` | |
| `respondedDomain` | `string \| undefined` | Actual Airbnb domain that responded (after any redirects). |

---

## Endpoints

### `get-details`

Aggregates listing page scrape + reviews + calendar + host + optional pricing. The main endpoint for getting everything about a listing.

**Params**

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `roomId` | Yes (or `roomUrl`) | string | Airbnb listing ID (numeric). |
| `roomUrl` | Yes (or `roomId`) | string | Full listing URL. |
| `checkIn` | No | string | ISO date for price quote. Both `checkIn` and `checkOut` required for pricing. |
| `checkOut` | No | string | ISO date for price quote. |
| `adults` | No | number | Guest count for pricing (default: 1). |

**Response data**: `Listing` object with additional nested data.

```json
{
  "id": 1517327104888328986,
  "title": "Listing title",
  "name": "Listing name",
  "url": "https://www.airbnb.com/rooms/1517327104888328986",
  "coordinates": { "latitude": 53.34, "longitude": -6.26 },
  "roomType": "Entire home",
  "isSuperhost": true,
  "homeTier": null,
  "personCapacity": 4,
  "rating": { "value": 4.92, "reviewCount": 148 },
  "host": { "id": "12345", "name": "John" },
  "about": "About text",
  "description": "Description text",
  "photos": [{ "url": "https://...", "caption": null }],
  "amenities": [{ "title": "Kitchen", "values": [{ "title": "Refrigerator" }] }],
  "houseRules": [{ "title": "Rules", "values": ["No smoking"] }],
  "locationDescriptions": [{ "title": "Location", "content": "..." }],
  "highlights": [{ "title": "Free parking", "subtitle": null }],
  "nightlyPrice": { "amount": 120, "currency": "$" },
  "reviews": [Review],
  "calendar": [CalendarMonth],
  "host": { "id": "12345", "name": "John", "about": "...", "isSuperhost": true, "responseRate": 98, "listingsCount": 5 },
  "price": PriceQuote
}
```

Price is only included when **both** `checkIn` and `checkOut` are provided.

**Example**
```
GET /?endpoint=get-details&roomId=1517327104888328986&domain=airbnb.ie
GET /?endpoint=get-details&roomId=1517327104888328986&checkIn=2026-08-01&checkOut=2026-08-07&adults=2
GET /?endpoint=get-details&roomUrl=https://www.airbnb.com/rooms/1517327104888328986
```

---

### `get-metadata-from-url`

Low-level listing page scrape. Returns the raw niobe data blob, API key, impression ID, and cookies. Used internally by `get-details`; also useful for getting `apiKey` + `impressionId` for subsequent calls.

**Params**

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `roomUrl` | Yes (live) | string | Full listing page URL. |

**Reprocess raw shape**: `{ "html": "...", "cookies": {} }`

**Response data**
```json
{
  "data": { ... },
  "priceInput": {
    "productId": "12345",
    "apiKey": "d4n3y...",
    "impressionId": "abc123..."
  },
  "cookies": { "country": "IE", "_user_attributes": "..." },
  "language": "en"
}
```

---

### `get-api-key`

Scrapes the Airbnb homepage to extract the public API key.

**Params**: None (besides `domain`).

**Response data**: `{ "apiKey": "d4n3y..." }`

**Example**
```
GET /?endpoint=get-api-key&domain=airbnb.ie
```

---

### `get-reviews`

Fetches reviews for a listing via GraphQL.

**Params**

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `roomUrl` | Yes (live) | string | Full listing URL (used to derive listing ID). |
| `roomId` | No | string | Listing ID. |
| `apiKey` | Yes (live) | string | Public API key. |

**Response data**: `Review[]`

```json
[{
  "id": "67890",
  "rating": 5,
  "createdAt": "2026-06-15T12:00:00.000Z",
  "reviewer": { "name": "Jane", "id": "user123" },
  "text": "Great place to stay!",
  "language": "en",
  "responses": [{ "member": { "name": "John" }, "response": "Thank you!" }]
}]
```

Paginated internally (50 per page, up to `maxPages`).

---

### `get-calendar`

Fetches availability calendar for a listing.

**Params**

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `roomId` | Yes (live) | string | Listing ID. |
| `apiKey` | Yes (live) | string | Public API key. |
| `months` | No | number | Number of months to fetch (default: 12). |
| `month` | No | number | Start month (default: current). |
| `year` | No | number | Start year (default: current). |

**Response data**: `CalendarMonth[]`

```json
[{
  "month": 7,
  "year": 2026,
  "days": [{
    "date": "2026-07-24",
    "available": true,
    "price": { "amount": 120, "currency": "$" },
    "minNights": 3
  }]
}]
```

---

### `get-host-details`

Fetches host profile by host ID.

**Params**

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `hostId` | Yes (live) | string | Airbnb host ID. |
| `apiKey` | Yes (live) | string | Public API key. |

**Response data**: `HostProfile`

```json
{
  "id": "12345",
  "name": "John",
  "about": "I love hosting!",
  "location": "Dublin, Ireland",
  "isSuperhost": true,
  "responseRate": 98,
  "responseTime": "within an hour",
  "listingsCount": 5
}
```

---

### `get-price`

Fetches a price quote for a listing on specific dates.

**Params**

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `roomId` | Yes (live) | string | Listing ID. |
| `checkIn` | Yes (live) | string | ISO check-in date. |
| `checkOut` | Yes (live) | string | ISO check-out date. |
| `adults` | No | number | Guest count (default: 1). |
| `apiKey` | Yes (live) | string | Public API key. |
| `impressionId` | Yes (live) | string | From `get-metadata-from-url`. |
| `cookies` | No | `Record<string, string>` | From `get-metadata-from-url`. |

**Response data**: `PriceQuote`

```json
{
  "main": {
    "price": { "amount": 840, "currency": "$" },
    "discountedPrice": { "amount": 756, "currency": "$" },
    "originalPrice": { "amount": 840, "currency": "$" },
    "qualifier": "Total before fees",
    "details": {
      "Nightly rate": "$120",
      "Cleaning fee": "$50",
      "Service fee": "$96",
      "Total": "$840"
    }
  },
  "available": true
}
```

---

### `get-listings-from-user`

Fetches all listings owned by a host.

**Params**

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `hostId` | Yes (live) | string | Airbnb host/user ID. |
| `apiKey` | Yes (live) | string | Public API key. |

**Response data**: `{ "listings": unknown[], "count": number }`

---

### `get-markets`

Fetches available markets from Airbnb's REST API.

**Params**

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `apiKey` | Yes (live) | string | Public API key. |

**Response data**: `unknown[]` (array of market objects). Callers typically use `[0].satori_parameters` and `[0].country_code`.

---

### `get-places-ids`

Autocomplete for places/locations (used as a search step). Returns place IDs for use with `search-all`.

**Params**

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `locationName` | Yes (live) | string | Search text (e.g. "Dublin"). |
| `country` | Yes (live) | string | Country code (e.g. "IE"). |
| `apiKey` | Yes (live) | string | Public API key. |
| `configToken` | Yes (live) | string | Satori config token from `get-markets`. |

**Response data**: `unknown[]` (autocomplete terms). Use `[0].location.google_place_id`.

---

### `search-all`

Full paginated Stays search via GraphQL POST. Returns all results across all pages.

**Params**

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `apiKey` | Yes (live) | string | Public API key. |
| `variables` | Yes (live) | JSON string | Search parameters (see below). |

**`variables` object fields**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `checkIn` | string | — | ISO check-in date. |
| `checkOut` | string | — | ISO check-out date. |
| `neLat` | number | — | Bounding box north-east latitude. |
| `neLong` | number | — | Bounding box north-east longitude. |
| `swLat` | number | — | Bounding box south-west latitude. |
| `swLong` | number | — | Bounding box south-west longitude. |
| `zoomValue` | number | — | Map zoom level. |
| `priceMin` | number | — | Minimum price filter. |
| `priceMax` | number | — | Maximum price filter. |
| `placeType` | string | — | Room type filter (`"room"`, `"entire_home"`, `"shared"`). |
| `amenities` | string[] | `[]` | Amenity filter IDs. |
| `freeCancellation` | boolean | `false` | Filter free cancellation only. |
| `adults` | number | `0` | Number of adults. |
| `children` | number | `0` | Number of children. |
| `infants` | number | `0` | Number of infants. |
| `minBedrooms` | number | `0` | Minimum bedrooms. |

**Response data**: `SearchHit[]`

```json
[{
  "roomId": 1517327104888328986,
  "title": "Beautiful apartment in city center",
  "name": "Beautiful apartment in city center",
  "coordinates": { "latitude": 53.34, "longitude": -6.26 },
  "rating": { "value": 4.92, "reviewCount": 148 },
  "badges": ["SUPERHOST"],
  "images": ["https://a0.muscache.com/..."],
  "price": {
    "unit": { "amount": 120, "currency": "$" },
    "discount": "10% off",
    "total": "$840"
  }
}]
```

**Example** (variables must be JSON-encoded):
```
GET /?endpoint=search-all&apiKey=d4n3y...&variables={"neLat":53.4,"neLong":-6.2,"swLat":53.3,"swLong":-6.3,"checkIn":"2026-08-01","checkOut":"2026-08-07","adults":2}
```

---

### `search-first-page`

Single-page Stays search. Returns first page of results plus a cursor for manual pagination.

**Params**: Same as `search-all`.

**Response data**: `{ "hits": SearchHit[], "nextCursor": "cursor_string_or_null" }`

Use `nextCursor` as a pagination token for subsequent pages (pass as `variables.cursor`).

---

### `search-all-from-url`

Convenience endpoint that parses an Airbnb search URL (`/s/...`) and delegates to `search-all`.

**Params**

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `url` | Yes (live) | string | Full Airbnb search URL. |
| `apiKey` | Yes (live) | string | Public API key. |

Extracts from URL: `check_in`, `check_out`, `ne_lat`, `ne_lng`, `sw_lat`, `sw_lng`, `zoom`, `price_min`, `price_max`, `adults`, `children`, `infants`.

**Response data**: `SearchHit[]`

**Example**
```
GET /?endpoint=search-all-from-url&url=https://www.airbnb.com/s/Dublin--Ireland/homes?checkin=2026-08-01&checkout=2026-08-07&adults=2&ne_lat=53.4&ne_lng=-6.2&sw_lat=53.3&sw_lng=-6.3&zoom=11&search_type=ENTIRE_PLACE
```

---

### `experience-search`

Full experience search pipeline: fetches markets → resolves place ID → paginated experience search.

**Params**

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `userInputText` | Yes (live) | string | Location to search (e.g. "Dublin"). |
| `apiKey` | Yes (live) | string | Public API key. |
| `checkIn` | No | string | ISO date. |
| `checkOut` | No | string | ISO date. |

**Response data**: `ExperienceHit[]`

```json
[{
  "id": "exp123",
  "title": "Irish Pub Crawl",
  "rating": { "value": 4.8, "reviewCount": 52 },
  "images": ["https://..."],
  "price": "$45",
  "duration": "3 hours",
  "category": "Food & Drink"
}]
```

---

### `experience-search-by-place-id`

Low-level experience search by Google Place ID. Used internally by `experience-search`.

**Params**

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `placeId` | Yes (live) | string | Google Place ID. |
| `locationName` | Yes (live) | string | Human-readable location name. |
| `apiKey` | Yes (live) | string | Public API key. |
| `checkIn` | Yes (live) | string | ISO date. |
| `checkOut` | Yes (live) | string | ISO date. |
| `cursor` | No | string | Pagination cursor. |

**Response data**: `{ "hits": ExperienceHit[], "nextCursor": "string_or_null" }`

---

### `fetch-stays-search-hash`

Fetches the current persisted-query hash for StaysSearch from Airbnb's webpack bundle. Useful for debugging when Airbnb rotates hashes.

**Params**: None (besides `domain`).

**Response data**: `{ "hash": "sha256hex...", "source": "dynamic" | "static" }`

---

## Domain Routing

Pass `?domain=<airbnb_domain>` to target a specific regional Airbnb site. Without it, defaults to `airbnb.com`.

```
GET /?endpoint=get-details&roomId=123&domain=airbnb.ie
```

The `respondedDomain` field in `meta` shows the actual domain that served the response (after any 3xx redirects).

### Supported Domains (60+)

Europe: `airbnb.at`, `airbnb.be`, `fr.airbnb.be`, `airbnb.cz`, `airbnb.dk`, `airbnb.fi`, `airbnb.fr`, `airbnb.de`, `airbnb.gr`, `airbnb.hu`, `airbnb.is`, `airbnb.ie`, `airbnb.it`, `airbnb.me`, `airbnb.nl`, `airbnb.no`, `airbnb.pl`, `airbnb.pt`, `airbnb.es`, `airbnb.cat`, `airbnb.se`, `airbnb.ch`, `fr.airbnb.ch`, `it.airbnb.ch`, `airbnb.co.uk`

Americas: `airbnb.com.ar`, `airbnb.com.bz`, `airbnb.com.bo`, `airbnb.com.br`, `airbnb.ca`, `fr.airbnb.ca`, `airbnb.cl`, `airbnb.com.co`, `airbnb.co.cr`, `airbnb.com.ec`, `airbnb.com.sv`, `airbnb.com.gt`, `airbnb.mx`, `airbnb.com.pa`, `airbnb.com.pe`, `airbnb.co.ve`

Asia-Pacific: `airbnb.com.au`, `airbnb.am`, `airbnb.az`, `airbnb.cn`, `airbnb.com.hk`, `airbnb.co.in`, `hi.airbnb.co.in`, `airbnb.co.id`, `airbnb.jp`, `airbnb.com.my`, `airbnb.co.nz`, `airbnb.com.ph`, `airbnb.com.sg`, `airbnb.co.kr`, `airbnb.com.tw`, `airbnb.com.vn`

Middle East & Africa: `airbnb.ae`, `zu.airbnb.co.za`, `xh.airbnb.co.za`, `airbnb.com.tr`, `airbnb.com.ua`

Subdomain: `ar.airbnb.com`, `sw.airbnb.com`, `sq.airbnb.com`, `bg.airbnb.com`, `hr.airbnb.com`, `he.airbnb.com`, `th.airbnb.com`

Default: `airbnb.com`

Invalid domains return: `{ "ok": false, "error": "Unknown domain: \"airbnb.xy\". Must be one of: airbnb.com, ...", "code": "input" }`

---

## Configuration

Runtime config lives in SSM at `/tsairbnb/<region>/endpoint-config` (JSON). Edit there to rotate user agents, override persisted-query hashes, change locale/currency — **no redeploy needed**.

### Config Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `userAgents` | `string[]` (min 1) | 4 Chrome UAs | Pool rotated deterministically per-day. |
| `acceptLanguage` | `string` | `"en-US,en;q=0.9"` | Sent as `Accept-Language` header. |
| `currency` | `string` | `"USD"` | Default currency for all requests. |
| `locale` | `string` | `"en"` | Default locale. |
| `proxies` | `string[]` | `[]` | HTTP proxy URLs (rotated per-day). |
| `hashOverrides` | `Record<string, string>` | `{}` | Override persisted-query SHA-256 hashes by operation name. |
| `tlsProfile` | `"chrome120"` \| `"chrome124"` \| `"chrome131"` | `"chrome124"` | curl-impersonate TLS fingerprint profile. |
| `timeoutMs` | `number` | `30000` | Per-request timeout in ms. |
| `maxPages` | `number` | `50` | Max pagination pages for paginated endpoints. |
| `itemsPerGrid` | `number` | `50` | Items per page in search. |

### Default Config
```json
{
  "userAgents": [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  ],
  "acceptLanguage": "en-US,en;q=0.9",
  "currency": "USD",
  "locale": "en",
  "proxies": [],
  "hashOverrides": {},
  "tlsProfile": "chrome124",
  "timeoutMs": 30000,
  "maxPages": 50,
  "itemsPerGrid": 50
}
```

---

## Type Reference

### Listing
| Field | Type | Nullable |
|-------|------|----------|
| `id` | `number` | ✓ |
| `title` | `string` | ✓ |
| `name` | `string` | ✓ |
| `url` | `string` | ✓ |
| `coordinates` | `{ latitude: number, longitude: number }` | both ✓ |
| `roomType` | `string` | ✓ |
| `isSuperhost` | `boolean` | ✓ |
| `homeTier` | `string` | ✓ |
| `personCapacity` | `number` | ✓ |
| `rating` | `{ value: number, reviewCount: number }` | both ✓ |
| `host` | `{ id: string, name: string }` | both ✓ |
| `about` | `string` | ✓ |
| `description` | `string` | ✓ |
| `photos` | `{ url: string, caption?: string }[]` | — |
| `amenities` | `{ title: string, values: { title: string, available?: boolean }[] }[]` | — |
| `houseRules` | `{ title: string, values: string[] }[]` | — |
| `nightlyPrice` | `{ amount: number, currency: string }` | ✓ |

### SearchHit
| Field | Type | Nullable |
|-------|------|----------|
| `roomId` | `number` | ✓ |
| `title` | `string` | ✓ |
| `name` | `string` | ✓ |
| `coordinates` | `{ latitude: number, longitude: number }` | both ✓ |
| `rating` | `{ value: number, reviewCount: number }` | both ✓ |
| `badges` | `string[]` | — |
| `images` | `string[]` | — |
| `price` | `{ unit: Money, discount: string, total: string }` | ✓ |

### PriceQuote
| Field | Type |
|-------|------|
| `main.price` | `{ amount: number, currency: string } \| null` |
| `main.discountedPrice` | `{ amount: number, currency: string } \| null` |
| `main.originalPrice` | `{ amount: number, currency: string } \| null` |
| `main.qualifier` | `string \| null` |
| `main.details` | `Record<string, string>` |
| `available` | `boolean` |

---

## Common Patterns

### Typical flow for listing details
```
1. GET /?endpoint=get-api-key&domain=airbnb.ie
   → { "ok": true, "data": { "apiKey": "d4n3y..." } }

2. GET /?endpoint=get-details&roomId=1517327104888328986&domain=airbnb.ie
   → Full listing with reviews, calendar, host

3. GET /?endpoint=get-details&roomId=1517327104888328986&checkIn=2026-08-01&checkOut=2026-08-07&domain=airbnb.ie
   → Full listing + pricing
```

### Typical search flow
```
1. GET /?endpoint=get-api-key&domain=airbnb.ie
2. GET /?endpoint=get-markets&apiKey=d4n3y...&domain=airbnb.ie
   → markets[0].satori_parameters.configToken
3. GET /?endpoint=search-all&apiKey=d4n3y...&variables={"neLat":53.4,"neLong":-6.2,"swLat":53.3,"swLong":-6.3,"checkIn":"2026-08-01","checkOut":"2026-08-07","adults":2}
   → SearchHit[]
```

### Reprocess failed parses
```
GET /?endpoint=get-details&mode=reprocess&raw=<URL-encoded original raw>
```
The `raw` field from any live response can be re-parsed without hitting Airbnb again.

### Error handling
All responses have `ok` boolean. Check `ok` first, then `error` + `code` for details. Warnings in `meta.warnings` indicate non-fatal issues (e.g. individual sub-fetches that failed but the main response was still returned).

### Rate limiting
Airbnb blocks aggressive scraping. The config `timeoutMs` and `maxPages` limit burst behavior. Rotate `userAgents` in SSM config periodically. Use `proxies` for high-volume use.

# Attribution

This project is a TypeScript reimplementation of **[pyairbnb](https://github.com/johnbalvin/pyairbnb/)** by John Balvin. pyairbnb is the original reference implementation and the source of the upstream URLs, persisted-query hashes, response-JSON paths, and the StaysSearch dynamic-hash resolver pattern that this port reimplements.

## pyairbnb sources consulted

This port is informed by the full pyairbnb source tree (`src/pyairbnb/`):

| Module | What we ported |
|---|---|
| `api.py` | `get_api_key` — homepage scrape for `api_config.key` |
| `start.py` | `get_details`, `search_all`, `search_first_page`, `search_all_from_url`, `get_reviews`, `get_calendar`, `get_price`, `experience_search` |
| `search.py` | `StaysSearch` GraphQL, `fetch_stays_search_hash` (dynamic webpack-scrape), `get_markets`, `get_places_ids`, `url_to_raw_params` |
| `details.py` / `parse.py` | listing-page HTML scrape (`#data-deferred-state-0` → `niobeClientData[0][1]`) |
| `standardize.py` | `from_search`, `from_details`, `encode_room_id`, `decode_listing_id` |
| `price.py` | `StaysPdpSections` quote (BOOK_IT_SIDEBAR section, `parse_price_symbol`) |
| `reviews.py` | `StaysPdpReviewsQuery` (offset-50 pagination) |
| `calendarinfo.py` | `PdpAvailabilityCalendar` (12 months, `data.merlin` path) |
| `host.py` | `UserProfileBeehiveListingQuery` (offset-1000 pagination) |
| `host_details.py` | `GetUserProfile` (`User:<id>` base64) |
| `experience.py` | `ExperiencesSearch` (markets → places → search orchestration) |

## pyairbnb bug history that shaped this port

- **#43 / #56 / #54** — StaysSearch persisted-query SHA rotates. Mitigated by the dynamic resolver in `src/registry/hashes-resolver.ts` + config override.
- **#41 / #42** — Missing listings from reading only `mapResults`. Fixed by reading `results.searchResults` + base64-decoding `demandStayListing.id`.
- **#61** — `parse_price_symbol` decimal bug (cents leaking into currency). Fixed in `src/lib/price.ts`.
- **#59 / #60** — Empty amenities. Fixed path: `data.node.pdpPresentation.amenities.seeAllAmenitiesGroups`.
- **#55** — `get_price` requires `impression_id` + `cookies` from a prior listing-page scrape. Documented as a two-step flow.

## TLS impersonation

pyairbnb uses `curl_cffi` with `impersonate="chrome124"`. `curl_cffi` wraps [curl-impersonate](https://github.com/lwthiker/curl-impersonate) (lwthiker/curl-impersonate, MIT) — a forked curl + patched BoringSSL that impersonates a real browser's TLS + HTTP/2 fingerprint. This port bundles the curl-impersonate binary in the Lambda container image (`Dockerfile`) and shells out to it per request via `src/http/curl-impersonate.ts`, behind the swappable `HttpClient` interface (`src/http/client.ts`).

## License

pyairbnb is MIT-licensed. This project is MIT-licensed (`LICENSE`).

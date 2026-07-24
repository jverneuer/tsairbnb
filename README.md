# tsairbnb

[![test](https://github.com/jverneuer/tsairbnb/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/jverneuer/tsairbnb/actions/workflows/test.yml?query=branch%3Amain)

A TypeScript reimplementation of [pyairbnb](https://github.com/johnbalvin/pyairbnb/), with a different ambition: a **robust, always-JSON HTTP wrapper** around Airbnb that is hardened against Airbnb's constant churn, exposes every endpoint as a serverless function behind CloudFront, and is fully bootstrapped in TypeScript IaC.

> **pyairbnb** by [John Balvin](https://github.com/johnbalvin/pyairbnb/) is the original reference implementation and the source of the upstream URLs, persisted-query hashes, response-JSON paths, and the StaysSearch dynamic-hash resolver pattern. This TypeScript port is a clean-room reimplementation informed by pyairbnb's API surface and the community's issue history. See [ATTRIBUTION.md](./ATTRIBUTION.md).

## Why

pyairbnb is a pure-Python library that wraps Airbnb's internal GraphQL + HTML endpoints. It depends on `curl_cffi` with `impersonate="chrome124"` to get past Airbnb's Cloudflare edge — plain `fetch`/`undici` returns 403. Airbnb's endpoints churn constantly: persisted-query SHA-256 hashes rotate, response JSON paths drift, webpack chunk filenames change, and a missing field can kill a whole extraction.

tsairbnb port the same 17 endpoints to TypeScript, deploy them as a single Lambda function behind CloudFront, and layer in:

- **Every result carries the original upstream document** (`raw`) — so failed crawls can be reprocessed later.
- **Every endpoint has `mode: 'live' | 'reprocess'`** — parse-only from a raw input lets you reprocess old captures against new parsers offline.
- **Identity (UA pool, JA3 profile, locale) is config-driven and hot-reloadable** via SSM — no redeploy to rotate.
- **Persisted-query hashes live in ONE registry module**, and the StaysSearch hash is resolved dynamically at runtime via the same webpack-scrape trick pyairbnb uses.
- **Snapshot / golden-master testing** as the early-warning radar — commit real Airbnb responses as fixtures now, before they change.
- **Parser strategy registry** per endpoint: multiple parser variants keyed by a shape detector, tried in order, with a `bare` fallback so a partial result + warnings comes back instead of a hard failure.

## Architecture

```
            ┌──────────────┐
            │  CloudFront   │  cache by URL+query, forward ?endpoint, ?mode, ?raw
            └──────┬───────┘
                   │
            ┌──────┴───────┐
            │  Lambda fn    │  container image (linux/amd64 or arm64)
            │  (FunctionURL)│  bundles the curl-impersonate TLS-impersonation binary
            │               │
            │  dispatcher   │  routes ?endpoint → handler, validates with Zod
            │  endpoints/   │  17 endpoints, each: live | reprocess
            │  parsers/     │  pure parse functions, strategy registry + bare fallback
            │  HttpClient   │  interface ─► CurlImpersonateClient (default, swappable)
            └───────────────┘
```

The Lambda is one function with a dispatcher that routes `?endpoint=<name>` to the right handler. CloudFront Function URL is the origin (no API Gateway — simpler, cheaper, and the API is fully open). SSM Parameter Store holds the runtime-editable config (UA pool, hashes, locale). CloudWatch logs every `parse`/`http`/`block` telemetry event so you can alert on churn.

### WAF (optional)

WAFv2 is not attached by default. CloudFront-scoped WAF requires deployment to **us-east-1**, which limits region choice. If you need rate-limiting, create a `CLOUDFRONT`-scoped WebACL in us-east-1 and attach it to the CloudFront distribution manually or via a separate CDK stack. The `cdk/lib/waf.ts` module is preserved for reference.

## The single most important technical fact

pyairbnb depends on `curl_cffi`'s `impersonate="chrome124"` to get past Airbnb's Cloudflare edge. `curl_cffi` wraps [curl-impersonate](https://github.com/lwthiker/curl-impersonate) — a forked curl + patched BoringSSL that impersonates a real browser's TLS + HTTP/2 fingerprint. Plain Node `fetch`/`undici` emits a non-browser JA3/H2 fingerprint and gets 403'd. **This is the #1 porting risk**, and it drives the Lambda runtime decision: the Lambda MUST be a container image bundling the curl-impersonate binary. See [ATTRIBUTION.md](./ATTRIBUTION.md).

## Quick start

```bash
npm install
npm run typecheck     # tsc --noEmit
npm test              # golden-master snapshot suite
npm run build         # esbuild → dist/lambda.js
npx cdk synth         # validate the IaC
npx cdk bootstrap     # one-time per account/region
npx cdk deploy        # deploys the stack
```

After deploy, the stack outputs the CloudFront URL and the (unthrottled) direct Lambda Function URL. Use the CloudFront URL.

## Usage

```
GET /?endpoint=<name>&mode=live|<params...>
GET /?endpoint=<name>&mode=live&domain=airbnb.ie|<params...>
GET /?endpoint=<name>&mode=reprocess&raw=<urlencoded JSON>
```

Every response is a JSON **envelope**:

```json
{
  "ok": true,
  "data": { /* endpoint-specific */ },
  "raw": { /* the original upstream document */ },
  "meta": {
    "fetchedAt": "2026-07-23T12:00:00.000Z",
    "endpoint": "get-details",
    "durationMs": 842,
    "parserVersion": "v2026-graphql",
    "warnings": [],
    "mode": "live",
    "respondedDomain": "airbnb.ie"
  }
}
```

```json
{
  "ok": false,
  "error": "blocked: Airbnb returned 403 (TLS fingerprint likely flagged)",
  "code": "block",
  "meta": { "endpoint": "get-details", "durationMs": 12, "parserVersion": "none", "warnings": [], "mode": "live" }
}
```

`code` is one of: `input` (400), `block` (403), `parse` (couldn't parse), `http-<n>`, `no-strategy-matched`, `handler-threw`.

Hit `/` with no `endpoint` for the endpoint list + usage.

## Endpoints (17)

| # | Endpoint | pyairbnb source | Notes |
|---|---|---|---|
| 1 | `get-api-key` | `api.py` | scrape homepage for `api_config.key` |
| 2 | `get-details` | `start.py` | aggregator: details + reviews + calendar + optional price + host_details |
| 3 | `get-metadata-from-url` | `details.py` | low-level: returns `(data, price_input, cookies)` |
| 4 | `get-price` | `price.py` | needs `impression_id` + `cookies` from a prior scrape |
| 5 | `get-reviews` | `reviews.py` | paginates offset 50 |
| 6 | `get-calendar` | `calendarinfo.py` | 12 months from today |
| 7 | `get-host-details` | `host_details.py` | `User:<id>` base64 |
| 8 | `get-listings-from-user` | `host.py` | paginates offset 1000 |
| 9 | `get-markets` | `search.py` | REST v2 |
| 10 | `get-places-ids` | `search.py` | REST v2 |
| 11 | `search-all` | `start.py` | paginates nextPageCursor |
| 12 | `search-first-page` | `start.py` | single page |
| 13 | `search-all-from-url` | `start.py` | parse /s/... URL → rawParams |
| 14 | `fetch-stays-search-hash` | `search.py` | dynamic webpack-scrape |
| 15 | `experience-search` | `experience.py` | orchestration: markets → places → search |
| 16 | `experience-search-by-place-id` | `experience.py` | single page, returns `[results, nextCursor]` |
| 17 | `parse-only` (utility) | — | given `?endpoint` + `?raw`, run parser only (reprocess mode) |

### Example

```
GET /?endpoint=get-details&mode=live&roomId=1614908485455733264
```

```
GET /?endpoint=get-price&mode=live&roomId=1614908485455733264&checkIn=2026-09-01&checkOut=2026-09-05&apiKey=<key>&impressionId=<id>
```

### Reprocess mode

Capture a raw response once (it's in every result's `raw` field), then reprocess it later against a newer parser — no network hit:

```
GET /?endpoint=get-details&mode=reprocess&raw=%7B%22data%22%3A...%7D
```

### Regional domain routing

Airbnb operates 60+ country-specific domains (`airbnb.fr`, `airbnb.de`, `airbnb.ie`, …). Lambda IPs are geolocated by Cloudflare — an Irish Lambda IP gets redirected to `airbnb.ie`, which returns HTML instead of JSON for GraphQL endpoints.

Use `?domain=<domain>` to target a specific domain explicitly:

```
GET /?endpoint=get-details&mode=live&roomId=1614908485455733264&domain=airbnb.fr
GET /?endpoint=get-api-key&mode=live&domain=airbnb.de
GET /?endpoint=search-all&mode=live&apiKey=<key>&domain=airbnb.ie
```

If no `?domain` is specified, the system follows redirects (curl `-L`) and reports the effective domain in `meta.respondedDomain`. Each domain has a default locale:

| Domain | Default locale |
|---|---|
| `airbnb.com` | `en` |
| `airbnb.fr` | `fr` |
| `airbnb.de` | `de` |
| `airbnb.ie` | `en` |
| `airbnb.es` | `es` |
| `airbnb.it` | `it` |
| `airbnb.co.uk` | `en` |
| `airbnb.com.au` | `en` |
| … | (60+ domains supported) |

Currency always defaults to **EUR**. Override per-request with `?currency=USD` if needed.

Invalid domains return a validation error:
```json
{ "ok": false, "error": "Unknown domain: \"airbnb.xy\". Must be one of: airbnb.com, airbnb.fr, ...", "code": "input" }
```

## Configuration

Runtime config lives in SSM at `/tsairbnb/endpoint-config` (JSON). Edit there to rotate user agents, override persisted-query hashes, change locale/currency — **no redeploy**. The shipped default:

```json
{
  "userAgents": ["Mozilla/5.0 ... Chrome/131 ...", "..."],
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

`itemsPerGrid` is pyairbnb's page-size knob (comment in pyairbnb: *"this can be exploited ;)"*). Default 50 — do NOT raise without ToS review.

## Deploy

The stack deploys to **three regions** — eu-west-2 (London, UK), us-east-1 (N. Virginia, US), and eu-west-1 (Ireland, EU) — each with its own Lambda + CloudFront + SSM.

```bash
export CDK_DEFAULT_ACCOUNT=123456789012

# Bootstrap all regions (one-time)
npx cdk bootstrap --profile default aws://123456789012/eu-west-2
npx cdk bootstrap --profile default aws://123456789012/us-east-1
npx cdk bootstrap --profile default aws://123456789012/eu-west-1

# Deploy all regions
npm run deploy:all
# Or deploy individually:
npm run deploy:uk    # eu-west-2 (London)
npm run deploy:us    # us-east-1 (N. Virginia)
npm run deploy:ie    # eu-west-1 (Ireland)
```

Each stack creates: Lambda (container image with curl-impersonate), CloudFront distribution, SSM parameter, CloudWatch log group. Outputs the public CloudFront URL for that region. WAFv2 is optional — see above.

## Test

```bash
npm test
```

The golden-master suite commits real Airbnb responses as fixtures (`test/fixtures/...`) and asserts each parser still extracts expected fields. When Airbnb changes shape, the test fails with a loud diff — your early-warning radar. Capture fresh fixtures with:

```bash
npm run capture -- get-details 1614908485455733264
```

## Project layout

```
tsairbnb/
├── cdk/                   # IaC (TypeScript CDK v2)
│   ├── bin/app.ts
│   └── lib/               # stack, waf, config
├── src/
│   ├── lambda.ts          # Lambda handler: dispatcher + envelope
│   ├── dispatcher.ts      # route ?endpoint → handler, validate with Zod
│   ├── config/            # schema, loader, defaults, SSM bootstrap
│   ├── http/              # HttpClient interface, curl-impersonate, headers, retry
│   ├── registry/          # persisted-query hashes (single source of truth) + dynamic resolver
│   ├── codecs/            # base64 id encode/decode
│   ├── lib/               # get (dotted-path), price parsing, domain routing
│   ├── types/             # envelope, domain types
│   ├── endpoints/         # 17 endpoint handlers (live + reprocess)
│   ├── parsers/           # pure parse functions + strategy registry
│   └── telemetry.ts       # plugin sink for parse/http/block events
├── test/                  # golden-master + unit
├── Dockerfile             # Lambda container: Node 20 + curl-impersonate
├── package.json
└── README.md
```

## Known fragility points (from pyairbnb's bug history)

| Risk | Mitigation |
|---|---|
| StaysSearch hash rotates (issues #43/#56/#54) | Dynamic resolver + config override + single source of truth |
| Missing listings (#41/#42) | Parse `results.searchResults` (not mapResults), base64-decode `demandStayListing.id` |
| Price parser decimal bug (#61) | Verified against `"$1,234.56"` and `"€34.99"` |
| Amenities empty (#59/#60) | Correct path `data.node.pdpPresentation.amenities.seeAllAmenitiesGroups` |
| `get_price` without prior scrape fails (#55) | Two-step flow documented; `get-details` returns the inputs `get-price` needs |
| TLS impersonation drifts as Chrome updates | curl-impersonate can target a specific Chrome version; swap `HttpClient` impl behind the interface |
| Cloudflare geo-redirects Lambda to wrong domain | `?domain=` param targets a specific domain; `meta.respondedDomain` reports the effective domain after redirects |

## License

MIT. See [LICENSE](./LICENSE).

## Acknowledgments

This project is a TypeScript reimplementation of [pyairbnb](https://github.com/johnbalvin/pyairbnb/). pyairbnb's API surface, upstream URLs, persisted-query hashes, response-JSON paths, and the StaysSearch dynamic-hash resolver pattern are the foundation this port is built on. The TLS-impersonation approach via curl-impersonate mirrors what pyairbnb accomplishes with `curl_cffi(impersonate="chrome124")`. See [ATTRIBUTION.md](./ATTRIBUTION.md) for the full list of pyairbnb sources.

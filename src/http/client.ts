/**
 * HttpClient interface — the swap point for the TLS-impersonation engine.
 * Parsers depend on this interface, never on a concrete client.
 *
 * Default impl: CurlImpersonateClient (shells out to the bundled curl-impersonate binary).
 * Future impls (cycletls, a native binding, a headless browser) drop in here unchanged.
 */

export interface HttpRequest {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  /** POST body string. */
  body?: string;
}

export interface HttpResponse {
  status: number;
  body: string;
  /** Set-Cookie values merged into a single Cookie header value, if any. */
  cookies?: Record<string, string>;
  /** Effective URL after following redirects (requires -L). */
  effectiveUrl?: string;
}

export interface HttpClient {
  request(req: HttpRequest): Promise<HttpResponse>;
}

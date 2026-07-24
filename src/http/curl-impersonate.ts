import { spawn } from "node:child_process";
import { getConfig } from "../config/load.js";
import type { HttpClient, HttpRequest, HttpResponse } from "./client.js";
import { pickProxy } from "./headers.js";

const BINARY = "curl-impersonate-chrome";

/**
 * Default HttpClient: shells out to the curl-impersonate binary bundled in the Lambda image.
 * curl-impersonate is what pyairbnb's curl_cffi wraps — the faithful 1:1 port for TLS/H2
 * impersonation. See Dockerfile + ATTRIBUTION.md.
 *
 * One subprocess per request. Lambda cold start amortizes the binary load; per-request
 * subprocess cost (~5-15ms) is acceptable for this workload. ponytail: if latency becomes
 * an issue, run a long-lived curl-impersonate-based HTTP/2 client process and IPC to it.
 */
export class CurlImpersonateClient implements HttpClient {
  async request(req: HttpRequest): Promise<HttpResponse> {
    const args = this.buildArgs(req);
    const { status, stdout, cookieHeader, effectiveUrl } = await run(BINARY, args, req.body, getConfig().timeoutMs);

    // curl-impersonate writes Set-Cookie to a jar (-c flag); parse it.
    const cookies = cookieHeader ? parseCookieJar(cookieHeader) : {};

    return { status, body: stdout, cookies, effectiveUrl };
  }

  private buildArgs(req: HttpRequest): string[] {
    const proxy = pickProxy();
    const args = [
      "-s",
      "-S", // silent but show errors
      "-L", // follow redirects (Airbnb domain-switch redirects)
      "-X",
      req.method ?? "GET",
      "-w",
      "\n__HTTP_STATUS__:%{http_code}\n__URL_EFFECTIVE__:%{url_effective}",
      "-D",
      "-", // dump response headers to stdout so we can read status
      "-c",
      "-", // write cookies to stdout as a jar
      "--max-time",
      String(Math.ceil(getConfig().timeoutMs / 1000)),
    ];
    if (proxy) args.push("--proxy", proxy);
    for (const [k, v] of Object.entries(req.headers ?? {})) args.push("-H", `${k}: ${v}`);
    args.push(req.url);
    return args;
  }
}

/** The default client instance. Override via setClient() in tests. */
let client: HttpClient = new CurlImpersonateClient();

export function getClient(): HttpClient {
  return client;
}

export function setClient(c: HttpClient): void {
  client = c;
}

export function run(
  bin: string,
  args: string[],
  body: string | undefined,
  timeoutMs: number,
): Promise<{ status: number; stdout: string; cookieHeader: string; effectiveUrl: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { timeout: timeoutMs });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    if (body) child.stdin.write(body);
    child.stdin.end();
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && code !== null && stdout.length === 0) {
        reject(new Error(`${bin} exited ${code}: ${stderr}`));
        return;
      }
      // Split the cookie jar (-c -) from the response body.
      const { status, body: clean, cookies, effectiveUrl } = demux(stdout);
      resolve({ status, stdout: clean, cookieHeader: cookies, effectiveUrl });
    });
  });
}

/** curl-impersonate interleaves the cookie jar (-c -) with headers (-D -) + body. Demux. */
export function demux(stdout: string): { status: number; body: string; cookies: string; effectiveUrl: string } {
  // Status line from -w trailer
  const statusMatch = stdout.match(/__HTTP_STATUS__:(\d+)/);
  const status = statusMatch ? Number(statusMatch[1]) : 200;

  // Effective URL from -w trailer
  const urlMatch = stdout.match(/__URL_EFFECTIVE__:(.+)/);
  const effectiveUrl = urlMatch ? urlMatch[1]!.trim() : "";

  // Cookie jar block: lines starting with "#HttpOnly_" or "# " are Netscape jar comments/rows.
  const cookieLines = stdout
    .split("\n")
    .filter((l) => /^\S+\s+FALSE|TRUE|TRUE\s+/.test(l) || l.startsWith("#HttpOnly_") || l.startsWith("# Netscape"))
    .join("\n");

  // Body: everything after the blank line separating headers from body.
  const sep = stdout.indexOf("\r\n\r\n");
  const body = sep >= 0 ? stdout.slice(sep + 4).replace(/__HTTP_STATUS__:\d+\s*$/, "").replace(/__URL_EFFECTIVE__:\S+\s*$/, "") : stdout;

  return { status, body, cookies: cookieLines, effectiveUrl };
}

export function parseCookieJar(jar: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of jar.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const cols = line.split("\t");
    if (cols.length >= 7) {
      const name = cols[5];
      const value = cols[6];
      if (name && value) out[name] = value;
    }
  }
  return out;
}

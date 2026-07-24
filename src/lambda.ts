import type { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { initFromSsm } from "./config/ssm-bootstrap.js";
import { dispatch, listEndpoints } from "./dispatcher.js";

/**
 * Lambda handler. Routes CloudFront Function URL requests:
 *   GET /?endpoint=get-details&mode=live&roomId=1614908485455733264
 *   GET /?endpoint=get-details&mode=reprocess&raw=<urlencoded json>
 *
 * Always returns JSON. The envelope's `ok` tells callers success/failure; `raw` carries the
 * original upstream document so failed crawls can be reprocessed later.
 */

let initialized = false;
async function ensureInit() {
  if (initialized) return;
  await initFromSsm().catch(() => {
    // fall back to local defaults (already loaded)
  });
  initialized = true;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  await ensureInit();

  // Lambda Function URL event shape: { rawPath, rawQueryString, queryStringParameters, body }
  const qs: Record<string, string> = {};
  for (const [k, v] of Object.entries(event.queryStringParameters ?? {})) {
    if (v !== undefined) qs[k] = v;
  }
  const endpoint = qs.endpoint;
  const mode = (qs.mode ?? "live") as "live" | "reprocess";

  // Health / discovery endpoint.
  if (!endpoint) {
    return json(200, { ok: true, endpoints: listEndpoints(), usage: "?endpoint=<name>&mode=live|reprocess&raw=<json>" });
  }

  // Body (POST) can carry raw for reprocess mode.
  let raw: unknown;
  if (mode === "reprocess") {
    if (qs.raw) {
      try { raw = JSON.parse(decodeURIComponent(qs.raw)); } catch { return json(400, { ok: false, error: "raw must be valid JSON", code: "input" }); }
    } else if (event.body) {
      try { raw = JSON.parse(event.body); } catch { return json(400, { ok: false, error: "body must be valid JSON", code: "input" }); }
    }
  }

  const { raw: _rawQs, ...qsRest } = qs;
  console.log("[lambda] dispatching:", JSON.stringify({ endpoint, mode, ...qsRest }));
  const result = await dispatch({ endpoint, mode, raw, ...qsRest });
  console.log("[lambda] result:", JSON.stringify({ ok: result.ok, error: "error" in result ? result.error : undefined, code: "code" in result ? result.code : undefined }));
  const status = result.ok ? 200 : result.code === "input" ? 400 : result.code === "block" ? 403 : 502;
  return json(status, result);
}

function json(status: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode: status,
    headers: { "content-type": "application/json", "cache-control": "no-cache" },
    body: JSON.stringify(body),
  };
}

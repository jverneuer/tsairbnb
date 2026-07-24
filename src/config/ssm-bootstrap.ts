/**
 * Lambda bootstrap: load runtime config from SSM (/tsairbnb/<region>/endpoint-config) and apply.
 * Falls back to local defaults (already loaded) on any failure so the function still boots.
 * Cached for the container lifetime; refresh on a schedule if you want hot config.
 */

let bootstrapped = false;

export async function initFromSsm(): Promise<void> {
  if (bootstrapped) return;
  try {
    // Lazy import so non-Lambda environments (tests, local) don't need @aws-sdk.
    const { SSMClient, GetParameterCommand } = await import("@aws-sdk/client-ssm");
    const region = process.env.AWS_REGION ?? process.env.CDK_DEFAULT_REGION ?? "us-east-1";
    const client = new SSMClient({ region });
    const out = await client.send(new GetParameterCommand({ Name: `/tsairbnb/${region}/endpoint-config` }));
    const value = out.Parameter?.Value;
    if (value) {
      console.log("[ssm] loaded config from", `/tsairbnb/${region}/endpoint-config`);
      const { loadConfig } = await import("./load.js");
      loadConfig(JSON.parse(value));
    }
  } catch (e) {
    console.error("[ssm] failed to bootstrap, using defaults:", (e as Error).message);
  } finally {
    bootstrapped = true;
  }
}

import { DEFAULT_CONFIG } from "../../src/config/defaults.js";

/**
 * The runtime config string stored in SSM (/tsairbnb/endpoint-config).
 * Lambda reads + hot-reloads this. Edit in SSM → no redeploy.
 */
export function configParams(): string {
  return JSON.stringify(DEFAULT_CONFIG);
}

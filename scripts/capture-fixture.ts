#!/usr/bin/env tsx
/**
 * Capture a real Airbnb response and save it as a golden-master fixture.
 * Usage: npm run capture -- <endpoint> <id>
 * Example: npm run capture -- get-details 1614908485455733264
 *
 * Requires a working HttpClient (i.e. curl-impersonate binary on PATH, or a mocked client).
 * In CI this is skipped; locally it lets you refresh fixtures before Airbnb changes shape.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const [endpoint, id] = process.argv.slice(2);
if (!endpoint || !id) {
  console.error("usage: npm run capture -- <endpoint> <id>");
  process.exit(1);
}

// Lazy import so the script can run without a full build.
const mod = await import(join(root, "src/endpoints", `${endpoint}.ts`));
const fn = mod[`${endpoint.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}`] ?? mod.default;
if (!fn) {
  console.error(`no export for endpoint ${endpoint}`);
  process.exit(1);
}

const result = await fn({ mode: "live", roomId: id });
const dir = join(root, "test/fixtures/live", endpoint);
mkdirSync(dir, { recursive: true });
const file = join(dir, `${id}.json`);
writeFileSync(file, JSON.stringify(result, null, 2));
console.log(`captured -> ${file}`);

import { spawnSync } from "node:child_process";
import fs from "node:fs";

const allowed = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  "NEXT_PUBLIC_FORUM_URL",
  "OPENROUTER_MODEL",
  "AI_ENABLED",
  "SUPABASE_JWKS_URL",
  "EMBED_ALLOWED_ORIGINS",
]);

const raw = fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const stripped = raw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")
  .replace(/,\s*([}\]])/g, "$1");
const { vars = {} } = JSON.parse(stripped);
for (const [key, value] of Object.entries(vars)) {
  if (!allowed.has(key) || process.env[key] || typeof value !== "string") continue;
  process.env[key] = value;
}

function ensureEsbuild() {
  for (const script of [
    "node_modules/esbuild/install.js",
    "node_modules/@opennextjs/aws/node_modules/esbuild/install.js",
  ]) {
    if (!fs.existsSync(new URL(`../${script}`, import.meta.url))) continue;
    const install = spawnSync(process.execPath, [script], { stdio: "inherit", env: process.env });
    if (install.status) process.exit(install.status ?? 1);
  }
}

const nestedNextBuild = process.env.FUTURE_ATLAS_NEXT_BUILD === "1";
const args = nestedNextBuild
  ? ["node_modules/next/dist/bin/next", "build"]
  : ["node_modules/@opennextjs/cloudflare/dist/cli/index.js", "build"];

if (!nestedNextBuild) {
  process.env.FUTURE_ATLAS_NEXT_BUILD = "1";
  ensureEsbuild();
}

const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);

import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();
// OpenNext defaults to `npm run build`. On Workers Builds that command starts
// the worker compile, so this script runs `next build` on the inner call.
config.buildCommand = "node scripts/with-public-env.mjs";

export default config;
